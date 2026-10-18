//! Native-parent-only durable store operations. No listener or browser consent.
use sentinel_av::vault::Vault;
use std::{
    ffi::OsString,
    io::{Read, Write},
    path::PathBuf,
    time::{Duration, Instant},
};
fn emit(value: serde_json::Value) -> Result<(), ()> {
    let mut out = std::io::stdout().lock();
    serde_json::to_writer(&mut out, &value).map_err(|_| ())?;
    writeln!(out).map_err(|_| ())?;
    out.flush().map_err(|_| ())
}
pub(super) fn run(args: Vec<OsString>) -> Result<(), ()> {
    let mode = args.first().and_then(|s| s.to_str()).ok_or(())?;
    if !matches!(mode, "--vault-list" | "--vault-restore" | "--vault-destroy")
        || args.len() != if mode == "--vault-list" { 2 } else { 3 }
    {
        return Err(());
    }
    let root = PathBuf::from(&args[1]);
    let label = root.to_string_lossy();
    if !root.is_absolute()
        || label.len() > 1024
        || label.to_ascii_lowercase().starts_with("e:")
        || label.starts_with("\\\\")
    {
        return Err(());
    }
    let vault = Vault::new(&root);
    let inventory = vault.inventory().map_err(|_| ())?;
    if mode == "--vault-list" {
        return emit(serde_json::to_value(inventory).map_err(|_| ())?);
    }
    let reference = args[2].to_str().ok_or(())?;
    let item = inventory
        .items
        .into_iter()
        .find(|i| {
            i.reference == reference
                && if mode == "--vault-restore" {
                    i.can_restore
                } else {
                    i.can_destroy
                }
        })
        .ok_or(())?;
    let source = vault.stored_original(reference).map_err(|_| ())?;
    let expires = Instant::now() + Duration::from_secs(30);
    emit(
        serde_json::json!({"type":"stored_preview","reference":reference,"source":source.to_str().ok_or(())?,"sha256":item.sha256,"bytes":item.bytes,"action":if mode=="--vault-restore"{"restore"}else{"destroy"}}),
    )?;
    let (sender, receiver) = std::sync::mpsc::sync_channel(1);
    std::thread::spawn(move || {
        let mut bytes = Vec::new();
        let result = std::io::stdin().lock().take(17).read_to_end(&mut bytes);
        let _ = sender.send((result.is_ok(), bytes));
    });
    let (read, decision) = receiver
        .recv_timeout(expires.saturating_duration_since(Instant::now()))
        .map_err(|_| ())?;
    if !read || decision != b"confirm\n" {
        return emit(serde_json::json!({"state":"declined","reference":reference}));
    }
    let current = vault.inventory().map_err(|_| ())?;
    if !current.items.iter().any(|i| i == &item)
        || vault.stored_original(reference).map_err(|_| ())? != source
    {
        return Err(());
    }
    if Instant::now() >= expires {
        return Err(());
    }
    if mode == "--vault-restore" {
        vault.restore_original(reference).map_err(|_| ())?;
    } else {
        vault.destroy_authenticated(reference).map_err(|_| ())?;
    }
    emit(
        serde_json::json!({"state":if mode=="--vault-restore"{"restored"}else{"destroyed"},"reference":reference}),
    )
}
