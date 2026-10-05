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
[assembly: AssemblyVersion("0.0.4.0")]

internal static class Program
{
    [STAThread]
    private static int Main(string[] args)
    {
        int port = 4173;
        bool noWindow = false;
        StaticApp server = null;
        try
        {
            foreach (string arg in args)
            {
                if (arg == "--no-window") noWindow = true;
                else if (arg.StartsWith("--port=")) port = int.Parse(arg.Substring(7));
                else throw new ArgumentException("未知启动参数。请直接双击 HawTend.exe。");
            }
            if (port < 1024 || port > 65535) throw new ArgumentException("端口不在有效范围内。");
            string address = "http://127.0.0.1:" + port + "/";
            if (IsReady(address))
            {
                if (!noWindow) OpenWindow(address);
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
                        if (IsReady(address)) { if (!noWindow) OpenWindow(address); return 0; }
                        Thread.Sleep(100);
                    }
                    throw new IOException("HawTend 已在启动，请稍后重新打开。");
                }
                try
                {
                    server = new StaticApp(port);
                    server.Start();
                    Application.EnableVisualStyles();
                    Application.SetCompatibleTextRenderingDefault(false);
                    using (DesktopContext context = new DesktopContext(address, !noWindow))
                    {
                        if (!noWindow) OpenWindow(address);
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

    internal static void OpenWindow(string address)
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
                Process.Start(new ProcessStartInfo(path, "--app=\"" + address + "\"") { UseShellExecute = true });
                return;
            }
        }
        Process.Start(new ProcessStartInfo(address) { UseShellExecute = true });
    }
}

internal sealed class DesktopContext : ApplicationContext
{
    private NotifyIcon tray;
    private Icon icon;
    private ContextMenuStrip menu;

    internal DesktopContext(string address, bool showTray)
    {
        if (!showTray) return;
        using (Stream resource = Assembly.GetExecutingAssembly().GetManifestResourceStream("HawTend.Icon"))
            icon = new Icon(resource, 32, 32);
        menu = new ContextMenuStrip();
        menu.Items.Add("打开 HawTend", null, delegate { Program.OpenWindow(address); });
        menu.Items.Add("退出 HawTend", null, delegate { ExitThread(); });
        tray = new NotifyIcon { Icon = icon, Text = "HawTend · 人生手账", ContextMenuStrip = menu, Visible = true };
        tray.DoubleClick += delegate { Program.OpenWindow(address); };
    }

    protected override void Dispose(bool disposing)
    {
        if (disposing)
        {
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

    internal StaticApp(int port)
    {
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
            default: return "application/octet-stream";
        }
    }

    internal void Stop() { stopped = true; listener.Stop(); }
}
