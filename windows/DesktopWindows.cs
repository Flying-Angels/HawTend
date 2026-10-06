using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Security.Principal;
using System.Text;
using System.Windows.Automation;
using System.Windows.Forms;

// Only independently verified Edge app windows receive WM_CLOSE. Edge processes
// are shared with ordinary browsing and must never be killed to close HawTend.
internal static class DesktopWindows
{
    internal static readonly int OpenMessage = RegisterWindowMessage("HawTend.Desktop.Open.v1");
    internal static readonly int ExitMessage = RegisterWindowMessage("HawTend.Desktop.Exit.v1");
    internal static string Caption(int port) { return "HawTend.Controller." + port + "." + WindowsIdentity.GetCurrent().User.Value; }
    internal const string ControllerProperty = "HawTend.Controller.v1";
    internal static bool Send(int port, int message)
    {
        IntPtr handle = FindWindow(null, Caption(port));
        if (handle == IntPtr.Zero || GetProp(handle, ControllerProperty) != new IntPtr(1)) return false;
        uint id; GetWindowThreadProcessId(handle, out id);
        try
        {
            using (Process process = Process.GetProcessById((int)id))
                if (!process.ProcessName.StartsWith("HawTend", StringComparison.OrdinalIgnoreCase)) return false;
        }
        catch (ArgumentException) { return false; }
        catch (InvalidOperationException) { return false; }
        catch (System.ComponentModel.Win32Exception) { return false; }
        return PostMessage(handle, message, IntPtr.Zero, IntPtr.Zero);
    }

    internal static IntPtr FindAppWindow(string nonce)
    {
        IntPtr result = IntPtr.Zero;
        EnumWindows(delegate(IntPtr handle, IntPtr ignored)
        {
            StringBuilder title = new StringBuilder(256), className = new StringBuilder(128);
            GetWindowText(handle, title, title.Capacity); GetClassName(handle, className, className.Capacity);
            if (!title.ToString().StartsWith("HawTend.Desktop." + nonce, StringComparison.Ordinal) || className.ToString() != "Chrome_WidgetWin_1") return true;
            uint id; GetWindowThreadProcessId(handle, out id);
            try
            {
                using (Process process = Process.GetProcessById((int)id))
                    if (process.ProcessName != "msedge") return true;
                // A normal browser window has a tab strip. Never own that window,
                // even if a HawTend page happens to set its title to our nonce.
                AutomationElement root = AutomationElement.FromHandle(handle);
                if (root.FindFirst(TreeScope.Descendants, new PropertyCondition(AutomationElement.ControlTypeProperty, ControlType.Tab)) != null) return true;
                result = handle;
                return false;
            }
            catch (Exception) { return true; } // Ownership could not be established.
        }, IntPtr.Zero);
        return result;
    }

    internal static void Focus(IntPtr handle) { if (IsIconic(handle)) ShowWindow(handle, 9); SetForegroundWindow(handle); }
    internal delegate bool EnumWindowCallback(IntPtr handle, IntPtr param);
    [DllImport("user32.dll")] internal static extern bool EnumWindows(EnumWindowCallback callback, IntPtr param);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] internal static extern IntPtr FindWindow(string className, string title);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] internal static extern int GetWindowText(IntPtr handle, StringBuilder text, int count);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] internal static extern int GetClassName(IntPtr handle, StringBuilder text, int count);
    [DllImport("user32.dll")] internal static extern uint GetWindowThreadProcessId(IntPtr handle, out uint process);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] internal static extern bool SetProp(IntPtr handle, string key, IntPtr value);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] internal static extern IntPtr GetProp(IntPtr handle, string key);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] internal static extern IntPtr RemoveProp(IntPtr handle, string key);
    [DllImport("user32.dll")] internal static extern bool IsWindow(IntPtr handle);
    [DllImport("user32.dll")] internal static extern bool IsIconic(IntPtr handle);
    [DllImport("user32.dll")] internal static extern bool ShowWindow(IntPtr handle, int command);
    [DllImport("user32.dll")] internal static extern bool SetForegroundWindow(IntPtr handle);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] internal static extern bool PostMessage(IntPtr handle, int message, IntPtr w, IntPtr l);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] internal static extern int RegisterWindowMessage(string name);
    [DllImport("user32.dll")] internal static extern bool SetProcessDPIAware();
}

internal sealed class ControllerWindow : Form
{
    internal Action OpenApp, ExitApp;
    internal ControllerWindow(int port)
    {
        Text = DesktopWindows.Caption(port); ShowInTaskbar = false;
        DesktopWindows.SetProp(Handle, DesktopWindows.ControllerProperty, new IntPtr(1));
    }
    protected override void WndProc(ref Message message)
    {
        if (message.Msg == DesktopWindows.OpenMessage && OpenApp != null) OpenApp();
        else if (message.Msg == DesktopWindows.ExitMessage && ExitApp != null) ExitApp();
        else base.WndProc(ref message);
    }
    protected override void Dispose(bool disposing)
    {
        if (IsHandleCreated) DesktopWindows.RemoveProp(Handle, DesktopWindows.ControllerProperty);
        base.Dispose(disposing);
    }
}

internal sealed class WindowTicket
{
    internal string Nonce;
    internal DateTime Deadline = DateTime.UtcNow.AddSeconds(20);
    internal IntPtr Handle;
    internal uint ProcessId;
    internal long ProcessStart;
    internal volatile bool Registered;
    internal volatile bool Failed;
}

internal sealed class WindowRegistry
{
    internal readonly ConcurrentDictionary<string, WindowTicket> Tickets = new ConcurrentDictionary<string, WindowTicket>();
    internal string Status(string nonce)
    {
        WindowTicket ticket;
        return Tickets.TryGetValue(nonce, out ticket) ? ticket.Registered ? "ready" : ticket.Failed ? "unmanaged" : "waiting" : "unknown";
    }
}
