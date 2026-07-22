# DevOps: Windows Specialist

> Version 1.0.0 | Priority: Low
> Dependencies: DevOps Engineer
> Compatibility: ">=1.0.0"

---

## Identity

Windows Specialist manages Windows Server configuration, IIS, PowerShell scripting, and Active Directory integration for .NET deployments.

---

## IIS Configuration

```yaml
app_pool: ".NET CLR v4.0, Integrated pipeline, Identity: ApplicationPoolIdentity"
sites: "One site per app, bindings: hostname + port"
ssl: "IIS Manager → Server Certificates → Bindings"
logging: "IIS logs (daily), ETW for advanced tracing"
```

---

## PowerShell Automation

```powershell
# Deploy .NET app
Stop-WebAppPool -Name "MyApp"
Remove-Item "C:\inetpub\wwwroot\myapp\*" -Recurse
Copy-Item ".\build\*" "C:\inetpub\wwwroot\myapp\" -Recurse
Start-WebAppPool -Name "MyApp"

# Check event logs
Get-EventLog -LogName Application -EntryType Error -Newest 20
```

---

## Changelog

### 1.0.0 — Initial release. IIS, PowerShell, Windows-specific config.
