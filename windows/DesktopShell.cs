using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Web.Script.Serialization;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

// HawTend owns this window. The WebView2 runtime renders the shared web UI;
// no Edge browser window or browser profile is used for normal operation.
internal sealed class DesktopShell : Form
{
    private readonly string address, dataFolder;
    private readonly int debugPort;
    private readonly Action openLegacy;
    private readonly Panel caption = new Panel();
    private readonly Label name = new Label();
    private readonly PictureBox mark = new PictureBox();
    private readonly CaptionButton minimize, maximize, close;
    private readonly WebView2 view = new WebView2();
    private readonly Label loading = new Label();
    private readonly JavaScriptSerializer json = new JavaScriptSerializer();
    private int captionHeight = 36, buttonWidth = 46, edge = 6;
    private float scale = 1;
    private bool initialized;
    private Rectangle normalBounds;
    private FormWindowState previousState = FormWindowState.Normal;
    private bool changingState;
    private FormWindowState beforeMinimized = FormWindowState.Normal;

    internal DesktopShell(string address, string dataFolder, int debugPort, Action openLegacy)
    {
        this.address = address; this.dataFolder = dataFolder; this.debugPort = debugPort; this.openLegacy = openLegacy;
        Text = "HawTend · 人生手账"; FormBorderStyle = FormBorderStyle.None;
        AutoScaleMode = AutoScaleMode.None; StartPosition = FormStartPosition.CenterScreen;
        using (Graphics g = CreateGraphics()) scale = g.DpiX / 96f;
        captionHeight = Px(36); buttonWidth = Px(46); edge = Px(6);
        MinimumSize = new Size(Px(760), Px(560));
        Rectangle work = Screen.FromControl(this).WorkingArea;
        Size = new Size(Math.Min(Px(1360), work.Width), Math.Min(Px(900), work.Height));
        MaximizedBounds = work;
        using (Stream resource = Assembly.GetExecutingAssembly().GetManifestResourceStream("HawTend.Icon")) Icon = new Icon(resource);
        BackColor = ColorTranslator.FromHtml("#f5f2eb");
        caption.BackColor = BackColor;
        caption.MouseDown += DragWindow;
        caption.DoubleClick += delegate { ToggleMaximize(); };
        name.Text = "HawTend"; name.Font = new Font("Segoe UI", 9); name.AutoSize = false;
        name.TextAlign = ContentAlignment.MiddleLeft; name.ForeColor = ColorTranslator.FromHtml("#777c70");
        name.MouseDown += DragWindow; name.DoubleClick += delegate { ToggleMaximize(); };
        using (Stream resource = Assembly.GetExecutingAssembly().GetManifestResourceStream("HawTend.CaptionMark"))
        using (Image image = Image.FromStream(resource)) mark.Image = new Bitmap(image);
        mark.SizeMode = PictureBoxSizeMode.Zoom; mark.MouseDown += DragWindow;
        minimize = new CaptionButton("最小化", 0, scale); maximize = new CaptionButton("最大化", 1, scale); close = new CaptionButton("关闭 HawTend", 2, scale);
        minimize.Click += delegate { ChangeState(FormWindowState.Minimized); };
        maximize.Click += delegate { ToggleMaximize(); };
        close.Click += delegate { Close(); };
        caption.Controls.AddRange(new Control[] { mark, name, minimize, maximize, close });
        view.DefaultBackgroundColor = BackColor;
        loading.Text = "正在打开你的手账…"; loading.Font = new Font("Microsoft YaHei UI", 11); loading.TextAlign = ContentAlignment.MiddleCenter;
        Controls.Add(view); Controls.Add(loading); Controls.Add(caption);
        Resize += delegate { LayoutWindow(); };
        LocationChanged += delegate
        {
            if (!changingState && previousState == FormWindowState.Normal && !IsIconic(Handle) && !IsZoomed(Handle)) normalBounds = CurrentWindowBounds();
        };
        normalBounds = CurrentWindowBounds();
        Shown += async delegate { await InitializeView(); };
        LayoutWindow();
    }

    private int Px(int logical) { return (int)Math.Round(logical * scale); }
    private Rectangle CurrentWindowBounds()
    {
        NativeRectangle rect;
        return IsHandleCreated && GetWindowRect(Handle, out rect) ? Rectangle.FromLTRB(rect.left, rect.top, rect.right, rect.bottom) : Bounds;
    }
    private void RestoreWindowBounds(Rectangle bounds)
    {
        if (bounds.IsEmpty) return;
        // WinForms caches dimensions including the removed native frame.
        // Restore the real outer rectangle rather than reapplying that cache.
        SetWindowPos(Handle, IntPtr.Zero, bounds.X, bounds.Y, bounds.Width, bounds.Height, 0x14);
    }
    private void LayoutWindow()
    {
        if (minimize == null) return;
        int inset = WindowState == FormWindowState.Maximized ? 0 : edge;
        caption.SetBounds(inset, inset, ClientSize.Width - inset * 2, captionHeight);
        mark.SetBounds(Px(12), Px(6), Px(24), Px(24)); name.SetBounds(Px(43), 0, Px(110), captionHeight);
        close.SetBounds(caption.Width - buttonWidth, 0, buttonWidth, captionHeight);
        maximize.SetBounds(caption.Width - buttonWidth * 2, 0, buttonWidth, captionHeight);
        minimize.SetBounds(caption.Width - buttonWidth * 3, 0, buttonWidth, captionHeight);
        maximize.Restored = WindowState == FormWindowState.Maximized;
        maximize.AccessibleName = maximize.Restored ? "还原窗口" : "最大化";
        maximize.Text = maximize.AccessibleName;
        maximize.Invalidate();
        view.SetBounds(inset, captionHeight + inset, ClientSize.Width - inset * 2, Math.Max(0, ClientSize.Height - captionHeight - inset * 2));
        loading.Bounds = view.Bounds;
    }

    private void DragWindow(object sender, MouseEventArgs e)
    {
        if (e.Button != MouseButtons.Left || e.Clicks != 1) return;
        ReleaseCapture(); SendMessage(Handle, 0xA1, new IntPtr(2), IntPtr.Zero);
    }
    private void ToggleMaximize()
    {
        MaximizedBounds = Screen.FromControl(this).WorkingArea;
        ChangeState(WindowState == FormWindowState.Maximized ? FormWindowState.Normal : FormWindowState.Maximized);
    }
    private void ChangeState(FormWindowState next)
    {
        if (next == FormWindowState.Minimized) beforeMinimized = WindowState;
        if (WindowState == FormWindowState.Normal) normalBounds = CurrentWindowBounds();
        Rectangle restore = normalBounds; changingState = true;
        try { WindowState = next; if (next == FormWindowState.Normal) RestoreWindowBounds(restore); }
        finally { changingState = false; previousState = WindowState; LayoutWindow(); }
    }
    internal void OpenOrFocus()
    {
        Rectangle restore = normalBounds;
        bool restoringNormal = WindowState == FormWindowState.Minimized && beforeMinimized == FormWindowState.Normal;
        if (WindowState == FormWindowState.Minimized) ChangeState(beforeMinimized);
        bool wasChanging = changingState; changingState = true;
        try
        {
            DesktopWindows.Focus(Handle);
            // Activation can apply WinForms' cached frame dimensions too.
            if (restoringNormal) RestoreWindowBounds(restore);
        }
        finally { changingState = wasChanging; previousState = WindowState; LayoutWindow(); }
    }

    private async System.Threading.Tasks.Task InitializeView()
    {
        try
        {
            CoreWebView2EnvironmentOptions options = new CoreWebView2EnvironmentOptions();
            // Remote debugging is available only for an explicitly isolated QA profile.
            if (debugPort != 0) options.AdditionalBrowserArguments = "--remote-debugging-port=" + debugPort + " --disable-gpu";
            CoreWebView2Environment environment = await CoreWebView2Environment.CreateAsync(null, dataFolder, options);
            if (IsDisposed) return;
            await view.EnsureCoreWebView2Async(environment);
            if (IsDisposed) return;
            CoreWebView2 core = view.CoreWebView2;
            core.Settings.AreDevToolsEnabled = debugPort != 0;
            core.Settings.AreDefaultContextMenusEnabled = false;
            core.Settings.IsStatusBarEnabled = false;
            core.Settings.IsBuiltInErrorPageEnabled = false;
            core.NavigationStarting += delegate(object sender, CoreWebView2NavigationStartingEventArgs e)
            {
                if (!e.Uri.StartsWith(address, StringComparison.Ordinal) && !e.Uri.StartsWith("blob:" + address, StringComparison.Ordinal)) e.Cancel = true;
            };
            core.NewWindowRequested += delegate(object sender, CoreWebView2NewWindowRequestedEventArgs e)
            {
                e.Handled = true;
                Uri target;
                if (Uri.TryCreate(e.Uri, UriKind.Absolute, out target) && (target.Scheme == "https" || target.Scheme == "http"))
                    Process.Start(new ProcessStartInfo(target.AbsoluteUri) { UseShellExecute = true });
            };
            core.WebMessageReceived += delegate(object sender, CoreWebView2WebMessageReceivedEventArgs e)
            {
                if (!e.Source.StartsWith(address, StringComparison.Ordinal)) return;
                if (e.WebMessageAsJson.Length > 4096) return;
                try
                {
                    var message = json.Deserialize<System.Collections.Generic.Dictionary<string, object>>(e.WebMessageAsJson);
                    object type;
                    if (message == null || !message.TryGetValue("type", out type) || !(type is string)) return;
                    if ((string)type == "theme") { object theme; if (message.TryGetValue("theme", out theme)) ApplyTheme(theme as string); }
                    else if ((string)type == "legacy-open") openLegacy();
                }
                catch (ArgumentException) { }
                catch (InvalidCastException) { }
            };
            core.DownloadStarting += delegate(object sender, CoreWebView2DownloadStartingEventArgs e)
            {
                e.Handled = true;
                CoreWebView2Deferral deferral = e.GetDeferral();
                BeginInvoke(new Action(delegate
                {
                    using (deferral)
                    {
                        if (IsDisposed) { e.Cancel = true; return; }
                        using (SaveFileDialog dialog = new SaveFileDialog())
                        {
                            dialog.Title = "导出 HawTend 文件";
                            dialog.FileName = Path.GetFileName(e.ResultFilePath);
                            dialog.Filter = "手账与日历文件|*.json;*.ics|所有文件|*.*";
                            dialog.OverwritePrompt = true;
                            if (dialog.ShowDialog(this) == DialogResult.OK) e.ResultFilePath = dialog.FileName;
                            else e.Cancel = true;
                        }
                    }
                }));
            };
            core.ProcessFailed += delegate { ShowError("页面暂时停止响应。请关闭并重新打开 HawTend，已保存的手账仍在本机。"); };
            core.NavigationCompleted += delegate(object sender, CoreWebView2NavigationCompletedEventArgs e)
            {
                if (IsDisposed) return;
                if (!e.IsSuccess) ShowError("手账页面暂时无法打开，请关闭并重新打开 HawTend。");
                else { initialized = true; loading.Visible = false; }
            };
            await core.AddScriptToExecuteOnDocumentCreatedAsync("window.__HAWTEND_DESKTOP__ = true;");
            if (!IsDisposed) core.Navigate(address);
        }
        catch (WebView2RuntimeNotFoundException)
        {
            if (IsDisposed) return;
            ShowError("需要免费的 Microsoft WebView2 运行时。安装后重新打开 HawTend；无需安装 Edge 浏览器。");
            Button install = new Button { Text = "打开官方下载页", AutoSize = true, Location = new Point(Px(24), captionHeight + Px(24)) };
            install.Click += delegate { Process.Start(new ProcessStartInfo("https://developer.microsoft.com/microsoft-edge/webview2/") { UseShellExecute = true }); };
            Controls.Add(install); install.BringToFront();
        }
        catch (Exception)
        {
            if (!IsDisposed) ShowError("桌面页面暂时无法初始化，请关闭并重新打开 HawTend。记录文件夹未作更改。");
        }
    }
    private void ShowError(string text) { if (IsDisposed) return; loading.Text = text; loading.Visible = true; loading.BringToFront(); caption.BringToFront(); }
    private void ApplyTheme(string theme)
    {
        string color = theme == "forest" ? "#edf1e9" : theme == "dusk" ? "#f4eef0" : "#f5f2eb";
        BackColor = caption.BackColor = name.BackColor = mark.BackColor = ColorTranslator.FromHtml(color);
        foreach (CaptionButton button in new[] { minimize, maximize, close }) { button.BackColor = BackColor; button.Invalidate(); }
        if (initialized) view.DefaultBackgroundColor = BackColor;
    }

    protected override CreateParams CreateParams
    {
        get
        {
            CreateParams cp = base.CreateParams;
            // Keep resizing and system commands, but own the entire caption.
            cp.Style &= ~0x00c00000; // WS_CAPTION
            cp.Style |= 0x40000 | 0x20000 | 0x10000 | 0x80000;
            return cp;
        }
    }
    protected override void OnHandleCreated(EventArgs e)
    {
        base.OnHandleCreated(e);
        int round = 2; DwmSetWindowAttribute(Handle, 33, ref round, 4);
        FrameMargin margins = new FrameMargin { left = 1, right = 1, top = 1, bottom = 1 }; DwmExtendFrameIntoClientArea(Handle, ref margins);
    }
    protected override void WndProc(ref Message m)
    {
        if (m.Msg == 0x47 && !changingState && previousState != FormWindowState.Normal && !IsIconic(Handle) && !IsZoomed(Handle))
        {
            // Keep the guard for the whole WINDOWPOSCHANGED: WinForms can
            // resize again after its nested WM_SIZE handler has returned.
            Rectangle restore = normalBounds;
            changingState = true;
            try { base.WndProc(ref m); previousState = FormWindowState.Normal; RestoreWindowBounds(restore); LayoutWindow(); }
            finally { changingState = false; }
            return;
        }
        if (m.Msg == 0x5) // WM_SIZE also arrives when WinForms omits Resize.
        {
            FormWindowState next = m.WParam.ToInt32() == 1 ? FormWindowState.Minimized : m.WParam.ToInt32() == 2 ? FormWindowState.Maximized : FormWindowState.Normal;
            if (next == FormWindowState.Minimized && previousState != FormWindowState.Minimized) beforeMinimized = previousState;
            bool wasChanging = changingState;
            changingState = true;
            try
            {
                base.WndProc(ref m);
                previousState = next;
                if (next == FormWindowState.Normal && !wasChanging) normalBounds = CurrentWindowBounds();
                LayoutWindow();
            }
            finally { changingState = wasChanging; }
            return;
        }
        if (m.Msg == 0x112 && !changingState)
        {
            int command = m.WParam.ToInt32() & 0xfff0;
            if (command == 0xf030 || command == 0xf020 || command == 0xf120)
            {
                if (command == 0xf020) beforeMinimized = WindowState;
                if (WindowState == FormWindowState.Normal) normalBounds = CurrentWindowBounds();
                Rectangle restore = normalBounds; changingState = true;
                try { base.WndProc(ref m); if (WindowState == FormWindowState.Normal) RestoreWindowBounds(restore); }
                finally { changingState = false; previousState = WindowState; LayoutWindow(); }
                return;
            }
        }
        // Both NCCALCSIZE forms keep the entire window as our client area.
        if (m.Msg == 0x83) { m.Result = IntPtr.Zero; return; }
        // THICKFRAME/SYSMENU can still make DefWindowProc paint a classic
        // caption even without WS_CAPTION. Our controls already paint it.
        if (m.Msg == 0x85) { m.Result = IntPtr.Zero; return; } // WM_NCPAINT
        if (m.Msg == 0x86 && WindowState != FormWindowState.Minimized)
        {
            // Preserve native activation; -1 only prevents its frame repaint.
            m.LParam = new IntPtr(-1);
            base.WndProc(ref m);
            return;
        }
        if (m.Msg == 0x84 && WindowState == FormWindowState.Normal)
        {
            long value = m.LParam.ToInt64(); Point p = PointToClient(new Point((short)(value & 0xffff), (short)((value >> 16) & 0xffff)));
            bool left = p.X < edge, right = p.X >= ClientSize.Width - edge, top = p.Y < edge, bottom = p.Y >= ClientSize.Height - edge;
            int hit = top && left ? 13 : top && right ? 14 : bottom && left ? 16 : bottom && right ? 17 : left ? 10 : right ? 11 : top ? 12 : bottom ? 15 : 0;
            if (hit != 0) { m.Result = new IntPtr(hit); return; }
        }
        base.WndProc(ref m);
    }
    protected override void Dispose(bool disposing)
    {
        if (disposing) { if (mark.Image != null) mark.Image.Dispose(); if (Icon != null) Icon.Dispose(); }
        base.Dispose(disposing);
    }
    private struct FrameMargin { internal int left, right, top, bottom; }
    private struct NativeRectangle { internal int left, top, right, bottom; }
    [DllImport("user32.dll")] private static extern bool ReleaseCapture();
    [DllImport("user32.dll")] private static extern bool GetWindowRect(IntPtr handle, out NativeRectangle rect);
    [DllImport("user32.dll")] private static extern bool IsIconic(IntPtr handle);
    [DllImport("user32.dll")] private static extern bool IsZoomed(IntPtr handle);
    [DllImport("user32.dll")] private static extern bool SetWindowPos(IntPtr handle, IntPtr after, int x, int y, int width, int height, uint flags);
    [DllImport("user32.dll")] private static extern IntPtr SendMessage(IntPtr handle, int message, IntPtr w, IntPtr l);
    [DllImport("dwmapi.dll")] private static extern int DwmSetWindowAttribute(IntPtr handle, int attribute, ref int value, int size);
    [DllImport("dwmapi.dll")] private static extern int DwmExtendFrameIntoClientArea(IntPtr handle, ref FrameMargin margin);
}

internal sealed class CaptionButton : Button
{
    private readonly int glyph;
    private readonly float scale;
    private bool hover;
    internal bool Restored;
    internal CaptionButton(string label, int glyph, float scale)
    {
        this.glyph = glyph; this.scale = scale; Text = label; AccessibleName = label; AccessibleRole = AccessibleRole.PushButton;
        FlatStyle = FlatStyle.Flat; FlatAppearance.BorderSize = 0; TabStop = true;
        SetStyle(ControlStyles.UserPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.AllPaintingInWmPaint, true);
        MouseEnter += delegate { hover = true; Invalidate(); }; MouseLeave += delegate { hover = false; Invalidate(); };
    }
    protected override void OnPaint(PaintEventArgs e)
    {
        Color bg = hover ? glyph == 2 ? Color.FromArgb(194, 68, 60) : Color.FromArgb(226, 227, 216) : BackColor;
        e.Graphics.Clear(bg);
        e.Graphics.SmoothingMode = System.Drawing.Drawing2D.SmoothingMode.AntiAlias;
        float size = 10 * scale, x = (Width - size) / 2, y = (Height - size) / 2;
        using (Pen pen = new Pen(hover && glyph == 2 ? Color.White : Color.FromArgb(83, 95, 80), Math.Max(1, scale)))
        {
            if (glyph == 0) e.Graphics.DrawLine(pen, x, y + size / 2, x + size, y + size / 2);
            else if (glyph == 2) { e.Graphics.DrawLine(pen, x, y, x + size, y + size); e.Graphics.DrawLine(pen, x + size, y, x, y + size); }
            else if (Restored) { e.Graphics.DrawRectangle(pen, x + 2 * scale, y, size - 2 * scale, size - 2 * scale); using (SolidBrush brush = new SolidBrush(bg)) e.Graphics.FillRectangle(brush, x, y + 2 * scale, size - 2 * scale, size - 2 * scale); e.Graphics.DrawRectangle(pen, x, y + 2 * scale, size - 2 * scale, size - 2 * scale); }
            else e.Graphics.DrawRectangle(pen, x, y, size, size);
        }
        if (Focused) ControlPaint.DrawFocusRectangle(e.Graphics, new Rectangle(4, 4, Width - 8, Height - 8));
    }
}
