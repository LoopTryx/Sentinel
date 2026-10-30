#[cfg(windows)]
fn main() {
    let args: Vec<_> = std::env::args_os().skip(1).collect();
    if args.len() != 2 {
        std::process::exit(2);
    }
    let engine = sentinel_av::official_signatures::OfficialEngine::load(
        std::path::Path::new(&args[0]),
        std::path::Path::new(&args[1]),
    )
    .expect("official engine load failed");
    let harmless = engine.scan(b"Ordinary harmless text used to check native scanning.");
    assert_eq!(harmless.state, "no_match");
    println!(
        "{}",
        serde_json::json!({"signatures":engine.count,"builtAt":engine.built_at,"fresh":engine.fresh(),"harmless":harmless,"positiveSignatureAcceptance":"not_run","quarantinePerformed":false})
    );
}
#[cfg(not(windows))]
fn main() {
    eprintln!("Windows native signature qualification unavailable");
    std::process::exit(2);
}
