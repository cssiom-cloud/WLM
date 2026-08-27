param (
    [string]$PromptMessage = "ยืนยันตัวตนเพื่อเข้าถึง WLR Command Portal"
)

try {
    Add-Type -AssemblyName System.Runtime.WindowsRuntime
    $asTaskGeneric = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { 
        $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' 
    } | Select-Object -First 1

    [Windows.Security.Credentials.UI.UserConsentVerifier, Windows.Security.Credentials.UI, ContentType = WindowsRuntime] | Out-Null
    
    # Request real Windows Hello verification
    $op = [Windows.Security.Credentials.UI.UserConsentVerifier]::RequestVerificationAsync($PromptMessage)
    $task = $asTaskGeneric.MakeGenericMethod([Windows.Security.Credentials.UI.UserConsentVerificationResult]).Invoke($null, @($op))
    $task.Wait()
    
    $result = $task.Result.ToString()
    Write-Output $result
} catch {
    Write-Output "Error: $_"
}
