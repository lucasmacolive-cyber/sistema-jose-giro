import subprocess, os

edge_path = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
input_html = os.path.abspath("scratch/test.html")
output_pdf = os.path.abspath("scratch/test.pdf")

# Create a test HTML
with open(input_html, "w", encoding="utf-8") as f:
    f.write("<html><body><h1>Ola Mundo!</h1><p>Teste de impressao de diario.</p></body></html>")

print("Converting...")
cmd = [edge_path, "--headless", "--disable-gpu", f"--print-to-pdf={output_pdf}", input_html]
try:
    subprocess.run(cmd, check=True, timeout=30)
    print("Success!")
    print("PDF size:", os.path.getsize(output_pdf))
except Exception as e:
    print("Failed:", e)
