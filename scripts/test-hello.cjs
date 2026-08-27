const { execFile } = require('child_process');
const path = require('path');

function checkWindowsHello() {
  return new Promise((resolve) => {
    const psScript = `
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$asTaskGeneric = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { 
    $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation\`1' 
} | Select-Object -First 1

[Windows.Security.Credentials.UI.UserConsentVerifier, Windows.Security.Credentials.UI, ContentType = WindowsRuntime] | Out-Null
$op = [Windows.Security.Credentials.UI.UserConsentVerifier]::CheckAvailabilityAsync()
$task = $asTaskGeneric.MakeGenericMethod([Windows.Security.Credentials.UI.UserConsentVerifierAvailability]).Invoke($null, @($op))
$task.Wait()
Write-Output $task.Result.ToString()
    `.trim();

    execFile('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', psScript], (err, stdout) => {
      if (err) {
        resolve({ available: false, error: err.message });
      } else {
        const out = stdout.trim();
        resolve({ available: out === 'Available', status: out });
      }
    });
  });
}

checkWindowsHello().then(console.log);
