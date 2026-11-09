# PowerShell Static Web Server สำหรับรันแอปพลิเคชัน Exam Proctor Scheduler
$port = 8080
$prefix = "http://localhost:$port/"
$rootPath = $PSScriptRoot

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($prefix)

try {
    $listener.Start()
} catch {
    $port = 8088
    $prefix = "http://localhost:$port/"
    $listener = New-Object System.Net.HttpListener
    $listener.Prefixes.Add($prefix)
    try {
        $listener.Start()
    } catch {
        Write-Host "พอร์ตถูกใช้งานอยู่ เปิดเบราว์เซอร์ไปยัง $prefix ทันที..." -ForegroundColor Yellow
        Start-Process $prefix
        exit
    }
}

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "🎓 ระบบจัดตารางผู้คุมสอบ (Exam Proctor Scheduler)" -ForegroundColor Green
Write-Host "🚀 Server กำลังทำงานที่: $prefix" -ForegroundColor Yellow
Write-Host "💡 กำลังเปิดเว็บเบราว์เซอร์ให้อัตโนมัติ... (กด Ctrl+C เพื่อหยุด)" -ForegroundColor Gray
Write-Host "==========================================================" -ForegroundColor Cyan

# เปิดเว็บเบราว์เซอร์ให้อัตโนมัติทันที
Start-Process $prefix

$mimeTypes = @{
    ".html" = "text/html; charset=utf-8"
    ".js"   = "application/javascript; charset=utf-8"
    ".css"  = "text/css; charset=utf-8"
    ".json" = "application/json; charset=utf-8"
    ".png"  = "image/png"
    ".jpg"  = "image/jpeg"
    ".svg"  = "image/svg+xml"
    ".ttf"  = "font/ttf"
    ".woff" = "font/woff"
    ".woff2"= "font/woff2"
    ".csv"  = "text/csv; charset=utf-8"
}

while ($listener.IsListening) {
    try {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        $urlPath = $request.Url.LocalPath
        if ($urlPath -eq "/" -or $urlPath -eq "") {
            $urlPath = "/index.html"
        }

        $relativePath = $urlPath.TrimStart('/').Replace('/', '\')
        $filePath = Join-Path $rootPath $relativePath

        if (Test-Path $filePath -PathType Leaf) {
            $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
            $mime = $mimeTypes[$ext]
            if (-not $mime) { $mime = "application/octet-stream" }

            $response.ContentType = $mime
            $response.AddHeader("Access-Control-Allow-Origin", "*")
            $response.AddHeader("Cache-Control", "no-cache")

            $bytes = [System.IO.File]::ReadAllBytes($filePath)
            $response.ContentLength64 = $bytes.Length
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
        } else {
            $response.StatusCode = 404
            $msg = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found: $urlPath")
            $response.OutputStream.Write($msg, 0, $msg.Length)
        }
        $response.OutputStream.Close()
    } catch {
        $null = $_
    }
}
