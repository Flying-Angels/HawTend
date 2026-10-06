param([string]$Executable = 'releases/windows/HawTend.exe', [int]$Cycles = 12)
$ErrorActionPreference = 'Stop'
if ($Cycles -lt 1 -or $Cycles -gt 50) { throw 'Use 1-50 cycles.' }
$projectDir = Split-Path -Parent $PSScriptRoot
$exePath = Join-Path $projectDir $Executable
if (-not (Test-Path -LiteralPath $exePath)) { throw 'Build the Windows executable first.' }
if (Get-NetTCPConnection -LocalPort 4196 -State Listen -ErrorAction SilentlyContinue) { throw 'QA port 4196 is already in use.' }
# Only a newly created QA profile and this script's own window are used.
$outputDir = Join-Path $projectDir ('output/windows-frame/' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
Add-Type -ReferencedAssemblies System.Drawing @'
using System;
using System.Drawing;
using System.Runtime.InteropServices;
using System.Text;
public static class HawTendFrameQA {
    public const string Maximize = "\u6700\u5927\u5316", Restore = "\u8fd8\u539f\u7a97\u53e3", Minimize = "\u6700\u5c0f\u5316";
    public delegate bool Callback(IntPtr window, IntPtr param);
    [StructLayout(LayoutKind.Sequential)] public struct Rect { public int Left, Top, Right, Bottom; }
    [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
    [DllImport("user32.dll")] public static extern bool EnumWindows(Callback callback, IntPtr param);
    [DllImport("user32.dll")] public static extern bool EnumChildWindows(IntPtr window, Callback callback, IntPtr param);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetClassName(IntPtr window, StringBuilder text, int length);
    [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr window, out uint process);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetWindowText(IntPtr window, StringBuilder text, int length);
    [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr window, out Rect rect);
    [DllImport("user32.dll")] public static extern bool GetClientRect(IntPtr window, out Rect rect);
    [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr window, IntPtr after, int x, int y, int width, int height, uint flags);
    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr window, int command);
    [DllImport("user32.dll")] public static extern bool IsZoomed(IntPtr window);
    [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr window);
    [DllImport("user32.dll")] public static extern IntPtr SendMessage(IntPtr window, int message, IntPtr w, IntPtr l);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern IntPtr SendMessage(IntPtr window, int message, IntPtr w, string l);
    [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr window, int message, IntPtr w, IntPtr l);
    [DllImport("user32.dll")] private static extern IntPtr GetWindowDC(IntPtr window);
    [DllImport("user32.dll")] private static extern int ReleaseDC(IntPtr window, IntPtr dc);
    [DllImport("gdi32.dll")] private static extern bool BitBlt(IntPtr target, int x, int y, int width, int height, IntPtr source, int sx, int sy, uint operation);
    public static IntPtr Find(int process) {
        IntPtr found = IntPtr.Zero;
        EnumWindows(delegate(IntPtr window, IntPtr param) {
            uint owner; GetWindowThreadProcessId(window, out owner);
            if (owner != process) return true;
            var title = new StringBuilder(256); GetWindowText(window, title, title.Capacity);
            if (title.ToString().StartsWith("HawTend") && !title.ToString().Contains("Controller")) { found = window; return false; }
            return true;
        }, IntPtr.Zero);
        return found;
    }
    public static void CheckCalcSize(IntPtr window) {
        // wParam=FALSE uses RECT rather than NCCALCSIZE_PARAMS.
        var expected = new Rect { Left = 100, Top = 100, Right = 1500, Bottom = 1000 };
        IntPtr pointer = Marshal.AllocHGlobal(Marshal.SizeOf(typeof(Rect)));
        try {
            Marshal.StructureToPtr(expected, pointer, false);
            SendMessage(window, 0x83, IntPtr.Zero, pointer);
            var actual = (Rect)Marshal.PtrToStructure(pointer, typeof(Rect));
            if (actual.Left != expected.Left || actual.Top != expected.Top || actual.Right != expected.Right || actual.Bottom != expected.Bottom)
                throw new Exception("NCCALCSIZE(FALSE) reintroduced native frame insets.");
        } finally { Marshal.FreeHGlobal(pointer); }
    }
    public static void Click(IntPtr window, string label) {
        IntPtr button = IntPtr.Zero;
        EnumChildWindows(window, delegate(IntPtr child, IntPtr param) {
            var name = new StringBuilder(128); var type = new StringBuilder(128);
            GetWindowText(child, name, name.Capacity); GetClassName(child, type, type.Capacity);
            if (name.ToString() == label && type.ToString().Contains("BUTTON")) { button = child; return false; }
            return true;
        }, IntPtr.Zero);
        if (button == IntPtr.Zero) throw new Exception("Caption button missing: " + label);
        SendMessage(button, 0xf5, IntPtr.Zero, IntPtr.Zero);
    }
    public static int[] CaptureCaption(IntPtr window, string path) {
        Rect rect; GetWindowRect(window, out rect);
        using (var bitmap = new Bitmap(rect.Right - rect.Left, 80)) {
            using (var graphics = Graphics.FromImage(bitmap)) {
                IntPtr target = graphics.GetHdc(), source = GetWindowDC(window);
                try {
                    // Capture the existing window surface. PrintWindow could repaint
                    // the client area and hide the intermittent overdraw being tested.
                    if (!BitBlt(target, 0, 0, bitmap.Width, bitmap.Height, source, 0, 0, 0x00CC0020)) throw new Exception("Caption capture failed.");
                } finally { ReleaseDC(window, source); graphics.ReleaseHdc(target); }
            }
            bitmap.Save(path, System.Drawing.Imaging.ImageFormat.Png);
            int blue = 0, paper = 0;
            for (int y = 2; y < 40; y++) for (int x = 260; x < bitmap.Width - 260; x++) {
                Color color = bitmap.GetPixel(x, y);
                if (color.B > color.R + 10 && color.B > color.G + 5) blue++;
                if (Math.Abs(color.R - 245) < 3 && Math.Abs(color.G - 242) < 3 && Math.Abs(color.B - 235) < 3) paper++;
            }
            return new[] { blue, paper };
        }
    }
}
'@
[void][HawTendFrameQA]::SetProcessDPIAware()
$profile = Join-Path $outputDir 'profile'
$app = Start-Process -FilePath $exePath -ArgumentList @('--port=4196', "--browser-data-dir=`"$profile`"") -WindowStyle Hidden -PassThru
$handle = [IntPtr]::Zero
$checks = @()
function Confirm-Caption([string]$Step) {
    Start-Sleep -Milliseconds 100
    $pixels = [HawTendFrameQA]::CaptureCaption($handle, (Join-Path $outputDir ($Step + '.png')))
    if ($pixels[0] -ne 0 -or $pixels[1] -lt 10000) { throw "Custom caption was overwritten or absent at $Step (blue=$($pixels[0]), paper=$($pixels[1]))." }
    $window = [HawTendFrameQA+Rect]::new(); $client = [HawTendFrameQA+Rect]::new()
    [void][HawTendFrameQA]::GetWindowRect($handle, [ref]$window)
    [void][HawTendFrameQA]::GetClientRect($handle, [ref]$client)
    if ($client.Right -ne $window.Right - $window.Left -or $client.Bottom -ne $window.Bottom - $window.Top) { throw "Unexpected nonclient inset at $Step." }
    $measurement = @{ Step = $Step; BluePixels = $pixels[0]; PaperPixels = $pixels[1]; Width = $window.Right - $window.Left; Height = $window.Bottom - $window.Top }
    $measurement | ConvertTo-Json -Compress | Add-Content -LiteralPath (Join-Path $outputDir 'measurements.jsonl') -Encoding UTF8
    return $measurement
}
try {
    for ($i = 0; $i -lt 100; $i++) {
        $handle = [HawTendFrameQA]::Find($app.Id)
        if ($handle -ne [IntPtr]::Zero) { break }
        if ($app.HasExited) { throw 'QA application exited during startup.' }
        Start-Sleep -Milliseconds 100
    }
    if ($handle -eq [IntPtr]::Zero) { throw 'QA native window missing.' }
    [void][HawTendFrameQA]::SetWindowPos($handle, [IntPtr]::Zero, 100, 100, 1700, 1000, 0x14)
    Start-Sleep -Milliseconds 1000
    [HawTendFrameQA]::CheckCalcSize($handle)
    $checks += Confirm-Caption 'initial'
    for ($cycle = 1; $cycle -le $Cycles; $cycle++) {
        # These are the native messages delivered when switching applications.
        $inactive = [HawTendFrameQA]::SendMessage($handle, 0x86, [IntPtr]::Zero, [IntPtr]::Zero)
        if ($inactive -eq [IntPtr]::Zero) { throw 'Window refused deactivation.' }
        $checks += Confirm-Caption "inactive-$cycle"
        [void][HawTendFrameQA]::SendMessage($handle, 0x86, [IntPtr]1, [IntPtr]::Zero)
        [void][HawTendFrameQA]::SendMessage($handle, 0x85, [IntPtr]1, [IntPtr]::Zero)
        $checks += Confirm-Caption "active-redraw-$cycle"
        [void][HawTendFrameQA]::SetWindowPos($handle, [IntPtr]::Zero, 0, 0, 0, 0, 0x37)
        [void][HawTendFrameQA]::SendMessage($handle, 0xC, [IntPtr]::Zero, 'HawTend caption QA')
        $icon = [HawTendFrameQA]::SendMessage($handle, 0x7F, [IntPtr]::Zero, [IntPtr]::Zero)
        [void][HawTendFrameQA]::SendMessage($handle, 0x80, [IntPtr]::Zero, $icon)
        $checks += Confirm-Caption "metadata-frame-$cycle"
        if ($cycle % 2 -eq 0) { [HawTendFrameQA]::Click($handle, [HawTendFrameQA]::Maximize) }
        else { [void][HawTendFrameQA]::SendMessage($handle, 0x112, [IntPtr]0xf030, [IntPtr]::Zero) }
        if (-not [HawTendFrameQA]::IsZoomed($handle)) { throw 'System maximize failed.' }
        $checks += Confirm-Caption "maximize-$cycle"
        if ($cycle % 2 -eq 0) { [HawTendFrameQA]::Click($handle, [HawTendFrameQA]::Restore) }
        else { [void][HawTendFrameQA]::SendMessage($handle, 0x112, [IntPtr]0xf120, [IntPtr]::Zero) }
        $checks += Confirm-Caption "restore-$cycle"
        if ($cycle % 2 -eq 0) { [HawTendFrameQA]::Click($handle, [HawTendFrameQA]::Minimize) }
        else { [void][HawTendFrameQA]::ShowWindow($handle, 6) }
        if (-not [HawTendFrameQA]::IsIconic($handle)) { throw 'System minimize failed.' }
        Start-Sleep -Milliseconds 100
        if ($cycle % 2 -eq 0) {
            $reopen = Start-Process -FilePath $exePath -ArgumentList @('--port=4196', "--browser-data-dir=`"$profile`"") -WindowStyle Hidden -PassThru
            if (-not $reopen.WaitForExit(5000)) { throw 'Repeated launch failed to return.' }
            # The IPC request is posted; wait for the native window to finish it.
            Start-Sleep -Milliseconds 200
        } else { [void][HawTendFrameQA]::ShowWindow($handle, 9) }
        if ([HawTendFrameQA]::IsIconic($handle) -or [HawTendFrameQA]::IsZoomed($handle)) { throw 'System restore failed.' }
        $checks += Confirm-Caption "minimize-restore-$cycle"
        $rect = [HawTendFrameQA+Rect]::new(); [void][HawTendFrameQA]::GetWindowRect($handle, [ref]$rect)
        if ($rect.Right - $rect.Left -ne 1700 -or $rect.Bottom - $rect.Top -ne 1000) { throw "Normal bounds changed after cycle $cycle to $($rect.Right-$rect.Left)x$($rect.Bottom-$rect.Top)." }
    }
    [void][HawTendFrameQA]::SetWindowPos($handle, [IntPtr]::Zero, 100, 100, 1600, 950, 0x14)
    $checks += Confirm-Caption 'resize'
    $point = [IntPtr]((101 -shl 16) -bor 101)
    if ([HawTendFrameQA]::SendMessage($handle, 0x84, [IntPtr]::Zero, $point).ToInt32() -ne 13) { throw 'Top-left resize hit test failed.' }
    [void][HawTendFrameQA]::SendMessage($handle, 0x112, [IntPtr]0xf030, [IntPtr]::Zero)
    [void][HawTendFrameQA]::ShowWindow($handle, 6)
    $second = Start-Process -FilePath $exePath -ArgumentList @('--port=4196', "--browser-data-dir=`"$profile`"") -WindowStyle Hidden -PassThru
    if (-not $second.WaitForExit(5000)) { throw 'Repeated launch failed to return.' }
    Start-Sleep -Milliseconds 200
    if ([HawTendFrameQA]::Find($app.Id) -ne $handle -or [HawTendFrameQA]::IsIconic($handle) -or -not [HawTendFrameQA]::IsZoomed($handle)) { throw 'Repeated launch did not restore the maximized window.' }
    $checks += Confirm-Caption 'maximized-minimize-reopen'
    [void][HawTendFrameQA]::SendMessage($handle, 0x112, [IntPtr]0xf120, [IntPtr]::Zero)
    $checks += Confirm-Caption 'final-restore'
    $rect = [HawTendFrameQA+Rect]::new(); [void][HawTendFrameQA]::GetWindowRect($handle, [ref]$rect)
    if ($rect.Right - $rect.Left -ne 1600 -or $rect.Bottom - $rect.Top -ne 950) { throw 'Reopening lost the resized normal bounds.' }
    [void][HawTendFrameQA]::PostMessage($handle, 0x10, [IntPtr]::Zero, [IntPtr]::Zero)
    if (-not $app.WaitForExit(5000)) { throw 'QA close failed.' }
    if (Get-NetTCPConnection -LocalPort 4196 -State Listen -ErrorAction SilentlyContinue) { throw 'QA service remained after close.' }
    $checks | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $outputDir 'results.json') -Encoding UTF8
    @{ Version = (Get-Item -LiteralPath $exePath).VersionInfo.FileVersion; Cycles = $Cycles; Captures = $checks.Count; Passed = $true; Output = $outputDir } | ConvertTo-Json
} finally {
    if ($handle -ne [IntPtr]::Zero -and -not $app.HasExited) {
        [void][HawTendFrameQA]::PostMessage($handle, 0x10, [IntPtr]::Zero, [IntPtr]::Zero)
        [void]$app.WaitForExit(5000)
    }
}
