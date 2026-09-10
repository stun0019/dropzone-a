using System;
using System.Diagnostics;
using System.IO;

internal static class DropzoneBuilder
{
    private static readonly string[] ClientCandidates =
    {
        @"D:\Github\Game\_dropzone\client\dropzone-a",
        @"D:\Github\Game_dropzone\client\dropzone-a"
    };

    private static int Run(string file, string arguments, string directory)
    {
        using (var process = new Process())
        {
            process.StartInfo = new ProcessStartInfo
            {
                FileName = file,
                Arguments = arguments,
                WorkingDirectory = directory,
                UseShellExecute = false
            };
            process.Start();
            process.WaitForExit();
            return process.ExitCode;
        }
    }

    private static string FindCommand(string name)
    {
        var path = Environment.GetEnvironmentVariable("PATH") ?? "";
        foreach (var folder in path.Split(Path.PathSeparator))
        {
            var candidate = Path.Combine(folder.Trim('"'), name);
            if (File.Exists(candidate)) return candidate;
        }
        return null;
    }

    public static int Main()
    {
        Console.Title = "Dropzone Builder";
        Console.WriteLine("========================================");
        Console.WriteLine("          DROPZONE BUILD TOOL");
        Console.WriteLine("========================================\n");

        string client = null;
        foreach (var candidate in ClientCandidates)
            if (File.Exists(Path.Combine(candidate, "package.json"))) { client = candidate; break; }

        if (client == null)
        {
            Console.ForegroundColor = ConsoleColor.Red;
            Console.WriteLine("[ERROR] 找不到 dropzone-a 開發專案。");
            Console.ResetColor();
            Console.WriteLine("檢查路徑：\n" + string.Join("\n", ClientCandidates));
            Console.WriteLine("\n按任意鍵關閉...");
            Console.ReadKey(true);
            return 1;
        }

        Console.WriteLine("[1/3] 開發端：" + client);
        var vite = Path.Combine(client, "node_modules", "vite", "bin", "vite.js");
        var node = FindCommand("node.exe");
        if (node == null)
        {
            var bundled = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile),
                @".cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe");
            if (File.Exists(bundled)) node = bundled;
        }

        if (!File.Exists(vite))
        {
            Console.WriteLine("[2/3] 尚未安裝依賴，嘗試安裝...");
            var pnpm = FindCommand("pnpm.cmd");
            var npm = FindCommand("npm.cmd");
            var installer = pnpm ?? npm;
            if (installer == null || Run(installer, "install", client) != 0)
            {
                Console.ForegroundColor = ConsoleColor.Red;
                Console.WriteLine("[ERROR] 無法安裝依賴，請先安裝 Node.js LTS。");
                Console.ResetColor();
                Console.WriteLine("\n按任意鍵關閉...");
                Console.ReadKey(true);
                return 1;
            }
        }
        else Console.WriteLine("[2/3] 已找到本機依賴，跳過安裝。");

        if (node == null)
        {
            Console.ForegroundColor = ConsoleColor.Red;
            Console.WriteLine("[ERROR] 找不到 node.exe，請先安裝 Node.js LTS。");
            Console.ResetColor();
            Console.WriteLine("\n按任意鍵關閉...");
            Console.ReadKey(true);
            return 1;
        }

        Console.WriteLine("[3/3] 建立發布檔案：dist\n");
        var exitCode = Run(node, "\"" + vite + "\" build", client);
        Console.WriteLine();
        if (exitCode == 0)
        {
            Console.ForegroundColor = ConsoleColor.Green;
            Console.WriteLine("========================================");
            Console.WriteLine("完成！dist 已更新：");
            Console.WriteLine(Path.Combine(client, "dist"));
            Console.WriteLine("========================================");
            Console.ResetColor();
            Console.WriteLine("請自行將 dist 內容複製到測試遊玩端。");
        }
        else
        {
            Console.ForegroundColor = ConsoleColor.Red;
            Console.WriteLine("[ERROR] 建置失敗，請查看上方錯誤訊息。");
            Console.ResetColor();
        }
        Console.WriteLine("\n按任意鍵關閉...");
        Console.ReadKey(true);
        return exitCode;
    }
}
