Set WshShell = CreateObject("WScript.Shell")
' Obtém o diretório atual do script
strPath = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
' Executa o .bat de forma totalmente oculta (parâmetro 0)
WshShell.Run "cmd /c " & Chr(34) & strPath & "\iniciar_tudo.bat" & Chr(34), 0, False
