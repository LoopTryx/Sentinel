# IPC boundary evidence and next implementation gate

The current `shield-svc` crate contains a deny-by-default method policy and tests with simulated verified callers. It does **not** host a named pipe or authorize live requests.

The Windows transport must create distinct user and admin pipe endpoints with explicit DACLs and `PIPE_REJECT_REMOTE_CLIENTS`. Microsoft's [named pipe security guidance](https://learn.microsoft.com/en-us/windows/win32/ipc/named-pipe-security-and-access-rights) says the default security descriptor grants read access to Everyone and anonymous users; a default descriptor is therefore not an acceptable final configuration. A per-session logon SID on the DACL can restrict other sessions.

After a client sends a request, the server must call `ImpersonateNamedPipeClient`, read the actual thread token's SID and session, check elevation for admin methods, and always call `RevertToSelf`. Microsoft's [impersonation guidance](https://learn.microsoft.com/en-us/windows/win32/ipc/impersonating-a-named-pipe-client) describes that flow and notes that client impersonation level is client-controlled. No identity or role field in a JSON request may replace the OS token check.

Before enabling any policy method, integration tests must cover mismatched SID/session, low-integrity or non-elevated clients, remote connection attempts, client disconnects during impersonation, oversized/malformed frames, nonce replay, rate limits, and a service crash. Resource ownership checks remain necessary after method authorization.
