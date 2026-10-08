using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.IO.Compression;
using System.Net;
using System.Net.Sockets;
using System.Reflection;
using System.Text;
using System.Threading;
using System.Windows.Forms;

[assembly: AssemblyTitle("HawTend")]
[assembly: AssemblyDescription("HawTend 人生手账 · 本地桌面原型")]
[assembly: AssemblyVersion("0.0.14.0")]

internal static class Program
{
    [STAThread]
    private static int Main(string[] args)
    {
        int port = 4173;
        bool noWindow = false;
        string browserData = null;
        string legacyBrowserData = null;
        int debugPort = 0;
        StaticApp server = null;
        try
        {
            foreach (string arg in args)
            {
                if (arg == "--no-window") noWindow = true;
                else if (arg.StartsWith("--port=")) port = int.Parse(arg.Substring(7));
                else if (arg.StartsWith("--browser-data-dir=")) browserData = Path.GetFullPath(arg.Substring(19));
                else if (arg.StartsWith("--legacy-browser-data-dir=")) legacyBrowserData = Path.GetFullPath(arg.Substring(26));
                else if (arg.StartsWith("--devtools-port=")) debugPort = int.Parse(arg.Substring(16));
                else throw new ArgumentException("未知启动参数。请直接双击 HawTend.exe。");
            }
            if (port < 1024 || port > 65535) throw new ArgumentException("端口不在有效范围内。");
            string address = "http://127.0.0.1:" + port + "/";
            if (browserData != null && port == 4173) throw new ArgumentException("独立测试配置请使用其他端口，避免更换个人手账空间。");
            if ((debugPort != 0 || legacyBrowserData != null) && (browserData == null || port == 4173)) throw new ArgumentException("测试桥接需要独立端口和配置文件夹。");
            if (debugPort != 0 && (debugPort < 1024 || debugPort > 65535 || debugPort == port)) throw new ArgumentException("测试调试端口无效。");
            if (!noWindow && DesktopWindows.Send(port, DesktopWindows.OpenMessage)) return 0;
            if (IsReady(address))
            {
                if (!noWindow) throw new IOException("此地址已有本机预览服务。请先退出此前的预览，再打开桌面版。");
                return 0;
            }
            using (Mutex mutex = new Mutex(false, "Local\\HawTend.Desktop." + port))
            {
                bool owned;
                try { owned = mutex.WaitOne(0); }
                catch (AbandonedMutexException) { owned = true; }
                if (!owned)
                {
                    for (int attempt = 0; attempt < 30; attempt++)
                    {
                        if (IsReady(address)) { if (!noWindow && !DesktopWindows.Send(port, DesktopWindows.OpenMessage)) throw new IOException("本机预览已运行，请先退出预览。"); return 0; }
                        Thread.Sleep(100);
                    }
                    throw new IOException("HawTend 已在启动，请稍后重新打开。");
                }
                try
                {
                    WindowRegistry windows = new WindowRegistry();
                    server = new StaticApp(port, windows);
                    server.Start();
                    DesktopWindows.SetProcessDPIAware();
                    Application.EnableVisualStyles();
                    Application.SetCompatibleTextRenderingDefault(false);
                    string dataFolder = browserData ?? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "HawTend\\WebView2");
                    using (DesktopContext context = new DesktopContext(address, port, !noWindow, dataFolder, legacyBrowserData, debugPort, windows))
                    {
                        if (!noWindow) context.OpenOrFocus();
                        Application.Run(context);
                    }
                }
                finally { if (server != null) server.Stop(); mutex.ReleaseMutex(); }
            }
            return 0;
        }
        catch (Exception error)
        {
            string message = error is SocketException
                ? "本机 4173 端口可能被其他程序占用。请联系我处理；手账地址不会自动更换。"
                : error.Message;
            if (!noWindow) MessageBox.Show("HawTend 暂时无法打开。\n\n" + message, "HawTend", MessageBoxButtons.OK, MessageBoxIcon.Information);
            return 1;
        }
    }

    private static bool IsReady(string address)
    {
        try
        {
            HttpWebRequest request = (HttpWebRequest)WebRequest.Create(address);
            request.Proxy = null;
            request.Timeout = 800;
            request.ReadWriteTimeout = 800;
            request.AllowAutoRedirect = false;
            using (HttpWebResponse response = (HttpWebResponse)request.GetResponse())
            using (StreamReader reader = new StreamReader(response.GetResponseStream(), Encoding.UTF8))
            {
                char[] buffer = new char[8192];
                int count = reader.ReadBlock(buffer, 0, buffer.Length);
                return response.StatusCode == HttpStatusCode.OK && new string(buffer, 0, count).Contains("<title>HawTend");
            }
        }
        catch (WebException) { return false; }
    }

    internal static bool OpenWindow(string address, string browserData = null)
    {
        string[] paths = {
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), "Microsoft\\Edge\\Application\\msedge.exe"),
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "Microsoft\\Edge\\Application\\msedge.exe"),
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Microsoft\\Edge\\Application\\msedge.exe")
        };
        foreach (string path in paths)
        {
            if (File.Exists(path))
            {
                string arguments = "--app=\"" + address + "\"";
                if (browserData != null) arguments += " --user-data-dir=\"" + browserData + "\" --no-first-run --start-minimized";
                Process.Start(new ProcessStartInfo(path, arguments) { UseShellExecute = true, WindowStyle = ProcessWindowStyle.Hidden });
                return true;
            }
        }
        Process.Start(new ProcessStartInfo(address) { UseShellExecute = true });
        return false;
    }
}

internal sealed class DesktopContext : ApplicationContext
{
    private NotifyIcon tray;
    private Icon icon;
    private ContextMenuStrip menu;
    private readonly string address, browserData, legacyBrowserData;
    private readonly int debugPort;
    private DesktopShell shell;
    private readonly string ownerProperty = "HawTend.Owner." + Guid.NewGuid().ToString("N");
    private readonly WindowRegistry windows;
    private ControllerWindow controller;
    private System.Windows.Forms.Timer timer;
    private bool closing, hasOpened, unclaimed;
    private DateTime closeDeadline;

    internal DesktopContext(string address, int port, bool showTray, string browserData, string legacyBrowserData, int debugPort, WindowRegistry windows)
    {
        this.address = address; this.browserData = browserData; this.legacyBrowserData = legacyBrowserData; this.debugPort = debugPort; this.windows = windows;
        controller = new ControllerWindow(port) { OpenApp = OpenOrFocus, ExitApp = RequestExit };
        timer = new System.Windows.Forms.Timer { Interval = 250 };
        timer.Tick += delegate { PollWindows(); }; timer.Start();
        if (!showTray) return;
        using (Stream resource = Assembly.GetExecutingAssembly().GetManifestResourceStream("HawTend.TrayIcon"))
            icon = new Icon(resource, SystemInformation.SmallIconSize);
        menu = new ContextMenuStrip();
        menu.Items.Add("打开 HawTend", null, delegate { OpenOrFocus(); });
        menu.Items.Add("退出 HawTend", null, delegate { RequestExit(); });
        tray = new NotifyIcon { Icon = icon, Text = "HawTend · 人生手账", ContextMenuStrip = menu, Visible = true };
        tray.DoubleClick += delegate { OpenOrFocus(); };
    }

    internal void OpenOrFocus()
    {
        if (closing) return;
        if (shell != null && !shell.IsDisposed) { shell.OpenOrFocus(); return; }
        shell = new DesktopShell(address, browserData, debugPort, OpenLegacy);
        shell.FormClosed += delegate { RequestExit(); };
        hasOpened = true; shell.Show();
    }

    private void OpenLegacy()
    {
        if (closing) return;
        foreach (WindowTicket ticket in windows.Tickets.Values)
        {
            if (Owned(ticket)) { DesktopWindows.Focus(ticket.Handle); return; }
            if (!ticket.Registered && !ticket.Failed) return;
        }
        string nonce = Guid.NewGuid().ToString("N");
        WindowTicket next = new WindowTicket { Nonce = nonce };
        windows.Tickets[nonce] = next;
        if (!Program.OpenWindow(address + "?legacy-transfer=1#hawtend-window=" + nonce, legacyBrowserData))
        { next.Failed = true; unclaimed = true; if (menu != null) menu.Items[1].Text = "停止本机服务"; }
    }

    private bool Owned(WindowTicket ticket)
    {
        if (!ticket.Registered || !DesktopWindows.IsWindow(ticket.Handle) || DesktopWindows.GetProp(ticket.Handle, ownerProperty) != new IntPtr(1)) return false;
        uint id; DesktopWindows.GetWindowThreadProcessId(ticket.Handle, out id);
        if (id != ticket.ProcessId) return false;
        try { using (Process process = Process.GetProcessById((int)id)) return process.StartTime.ToUniversalTime().Ticks == ticket.ProcessStart; }
        catch (ArgumentException) { return false; }
        catch (InvalidOperationException) { return false; }
        catch (System.ComponentModel.Win32Exception) { return false; }
    }

    private void PollWindows()
    {
        int active = shell != null && !shell.IsDisposed ? 1 : 0;
        foreach (WindowTicket ticket in windows.Tickets.Values)
        {
            if (!ticket.Registered && !ticket.Failed)
            {
                IntPtr handle = DesktopWindows.FindAppWindow(ticket.Nonce);
                if (handle != IntPtr.Zero)
                {
                    uint id; DesktopWindows.GetWindowThreadProcessId(handle, out id);
                    try
                    {
                        using (Process process = Process.GetProcessById((int)id)) ticket.ProcessStart = process.StartTime.ToUniversalTime().Ticks;
                        if (DesktopWindows.SetProp(handle, ownerProperty, new IntPtr(1)))
                        { ticket.Handle = handle; ticket.ProcessId = id; ticket.Registered = true; if (closing) DesktopWindows.PostMessage(handle, 0x10, IntPtr.Zero, IntPtr.Zero); }
                    }
                    catch (ArgumentException) { }
                    catch (InvalidOperationException) { }
                    catch (System.ComponentModel.Win32Exception) { }
                }
                if (!ticket.Registered && DateTime.UtcNow > ticket.Deadline)
                {
                    ticket.Failed = true; unclaimed = true;
                    if (menu != null) menu.Items[1].Text = "停止本机服务";
                    if (tray != null) tray.ShowBalloonTip(5000, "HawTend", "未能管理这个浏览器窗口。请自行关闭页面；托盘可停止本机服务。", ToolTipIcon.Info);
                }
            }
            if (Owned(ticket) || (!ticket.Registered && !ticket.Failed)) active++;
        }
        if (active == 0 && (closing || (hasOpened && !unclaimed))) ExitThread();
        // Respect a cancelled browser close; do not terminate a shared Edge process.
        else if (closing && DateTime.UtcNow > closeDeadline) closing = false;
    }

    internal void RequestExit()
    {
        if (closing) return;
        closing = true; closeDeadline = DateTime.UtcNow.AddSeconds(10);
        if (shell != null && !shell.IsDisposed) shell.Close();
        foreach (WindowTicket ticket in windows.Tickets.Values)
            if (Owned(ticket)) DesktopWindows.PostMessage(ticket.Handle, 0x10, IntPtr.Zero, IntPtr.Zero);
        PollWindows();
    }

    protected override void Dispose(bool disposing)
    {
        if (disposing)
        {
            if (timer != null) { timer.Stop(); timer.Dispose(); }
            if (shell != null) shell.Dispose();
            foreach (WindowTicket ticket in windows.Tickets.Values)
                if (Owned(ticket)) DesktopWindows.RemoveProp(ticket.Handle, ownerProperty);
            if (controller != null) controller.Dispose();
            if (tray != null) { tray.Visible = false; tray.Dispose(); }
            if (menu != null) menu.Dispose();
            if (icon != null) icon.Dispose();
        }
        base.Dispose(disposing);
    }
}

// This serves only embedded app assets on loopback. There are no data-writing APIs
// and no file-system paths derived from requests. Personal data stays in IndexedDB.
internal sealed class StaticApp
{
    private readonly TcpListener listener;
    private readonly Dictionary<string, byte[]> files = new Dictionary<string, byte[]>(StringComparer.Ordinal);
    private readonly SemaphoreSlim slots = new SemaphoreSlim(32);
    private readonly string host;
    private volatile bool stopped;
    private readonly WindowRegistry windows;

    internal StaticApp(int port, WindowRegistry windows)
    {
        this.windows = windows;
        host = "127.0.0.1:" + port;
        listener = new TcpListener(IPAddress.Loopback, port);
        listener.ExclusiveAddressUse = true;
        using (Stream resource = Assembly.GetExecutingAssembly().GetManifestResourceStream("HawTend.Assets"))
        using (ZipArchive archive = new ZipArchive(resource, ZipArchiveMode.Read))
            foreach (ZipArchiveEntry entry in archive.Entries)
            {
                if (entry.FullName.EndsWith("/")) continue;
                using (Stream input = entry.Open())
                using (MemoryStream output = new MemoryStream())
                {
                    input.CopyTo(output);
                    files["/" + entry.FullName.Replace('\\', '/')] = output.ToArray();
                }
            }
        if (!files.ContainsKey("/index.html") || !files.ContainsKey("/sw.js")) throw new IOException("内置页面不完整，请联系我重新打包。");
    }

    internal void Start()
    {
        listener.Start(32);
        Thread worker = new Thread(AcceptClients) { IsBackground = true };
        worker.Start();
    }

    private void AcceptClients()
    {
        while (!stopped)
        {
            try
            {
                TcpClient client = listener.AcceptTcpClient();
                if (!slots.Wait(0)) { client.Close(); continue; }
                ThreadPool.QueueUserWorkItem(delegate { try { Serve(client); } finally { client.Close(); slots.Release(); } });
            }
            catch (SocketException) { if (!stopped) Stop(); }
            catch (ObjectDisposedException) { break; }
        }
    }

    private void Serve(TcpClient client)
    {
        try
        {
            client.ReceiveTimeout = 5000;
            client.SendTimeout = 5000;
            using (NetworkStream stream = client.GetStream())
            {
                StringBuilder headers = new StringBuilder();
                while (headers.Length < 16384)
                {
                    int value = stream.ReadByte();
                    if (value < 0) return;
                    headers.Append((char)value);
                    int n = headers.Length;
                    if (n >= 4 && headers[n - 4] == '\r' && headers[n - 3] == '\n' && headers[n - 2] == '\r' && headers[n - 1] == '\n') break;
                }
                if (headers.Length >= 16384) { Reply(stream, 431, "Headers Too Large", "text/plain", new byte[0], false); return; }
                string[] lines = headers.ToString().Split(new[] { "\r\n" }, StringSplitOptions.None);
                string[] request = lines[0].Split(' ');
                string requestHost = null;
                for (int i = 1; i < lines.Length; i++)
                    if (lines[i].StartsWith("Host:", StringComparison.OrdinalIgnoreCase)) requestHost = lines[i].Substring(5).Trim();
                if (requestHost != host) { Reply(stream, 400, "Bad Request", "text/plain", new byte[0], false); return; }
                if (request.Length != 3 || !request[1].StartsWith("/")) { Reply(stream, 400, "Bad Request", "text/plain", new byte[0], false); return; }
                bool head = request[0] == "HEAD";
                if (request[0] != "GET" && !head) { Reply(stream, 405, "Method Not Allowed", "text/plain", new byte[0], false); return; }
                string path = Uri.UnescapeDataString(request[1].Split('?')[0]);
                if (path.StartsWith("/_hawtend/window/", StringComparison.Ordinal))
                {
                    Reply(stream, 200, "OK", "text/plain", Encoding.ASCII.GetBytes(windows.Status(path.Substring(17))), head);
                    return;
                }
                if (path == "/") path = "/index.html";
                byte[] body;
                if (!files.TryGetValue(path, out body)) { Reply(stream, 404, "Not Found", "text/plain", new byte[0], head); return; }
                Reply(stream, 200, "OK", Mime(path), body, head);
            }
        }
        catch (IOException) { }
        catch (SocketException) { }
        catch (UriFormatException) { }
    }

    private static void Reply(Stream stream, int status, string reason, string mime, byte[] body, bool head)
    {
        string headers = "HTTP/1.1 " + status + " " + reason + "\r\nContent-Type: " + mime +
            "\r\nContent-Length: " + body.Length + "\r\nCache-Control: no-cache\r\nX-Content-Type-Options: nosniff\r\nConnection: close\r\n" +
            (status == 405 ? "Allow: GET, HEAD\r\n" : "") + "\r\n";
        byte[] bytes = Encoding.ASCII.GetBytes(headers);
        stream.Write(bytes, 0, bytes.Length);
        if (!head) stream.Write(body, 0, body.Length);
    }

    private static string Mime(string path)
    {
        switch (Path.GetExtension(path).ToLowerInvariant())
        {
            case ".html": return "text/html; charset=utf-8";
            case ".js": return "text/javascript; charset=utf-8";
            case ".css": return "text/css; charset=utf-8";
            case ".webmanifest": return "application/manifest+json; charset=utf-8";
            case ".json": return "application/json; charset=utf-8";
            case ".png": return "image/png";
            case ".svg": return "image/svg+xml";
            case ".ico": return "image/x-icon";
            case ".woff2": return "font/woff2";
            case ".woff": return "font/woff";
            case ".ttf": return "font/ttf";
            default: return "application/octet-stream";
        }
    }

    internal void Stop() { stopped = true; listener.Stop(); }
}
