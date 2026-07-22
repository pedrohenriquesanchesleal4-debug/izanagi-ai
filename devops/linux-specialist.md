# DevOps: Linux Specialist

> Version 1.0.0 | Priority: Medium
> Dependencies: DevOps Engineer
> Compatibility: ">=1.0.0"

---

## Identity

Linux Specialist manages Linux server configuration, hardening, performance tuning, and troubleshooting for production environments.

---

## Server Hardening

```yaml
ssh:
  - Port: 2222 (not 22)
  - Root login: disabled
  - Password auth: disabled
  - Key-only: yes

firewall:
  - Allow only: 80 (HTTP), 443 (HTTPS), 2222 (SSH)
  - Fail2ban: enabled for SSH + HTTP auth

updates:
  - Unattended-upgrades: security only
  - Automatic reboot: no (manual)

audit:
  - Lynis audit: weekly
  - Check: open ports, user accounts, world-writable files
```

---

## Performance Tuning

```ini
# sysctl.conf
net.core.somaxconn = 65535
net.ipv4.tcp_tw_reuse = 1
vm.swappiness = 10
vm.dirty_ratio = 40
vm.dirty_background_ratio = 10

# limits.conf
www-data soft nofile 65535
www-data hard nofile 65535
```

---

## Useful Commands

```bash
# Disk usage
du -sh /* | sort -rh | head -10

# Find large files
find / -type f -size +100M -exec ls -lh {} \; | sort -k5 -rh

# Process by memory/cpu
ps aux --sort=-%mem | head
ps aux --sort=-%cpu | head

# I/O wait
iostat -x 1
iotop

# Network
ss -tulpn
iftop
```

---

## Changelog

### 1.0.0 — Initial release. Hardening, tuning, commands.
