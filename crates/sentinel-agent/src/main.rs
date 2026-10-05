use sentinel_agent::stdio::serve_once;

fn main() {
    let arguments: Vec<_> = std::env::args().skip(1).collect();
    #[cfg(windows)]
    if arguments.len() == 5
        && arguments[0] == "--live-lifecycle"
        && arguments[1] == "--pipe"
        && arguments[3] == "--journal"
    {
        if sentinel_agent::live::serve_lifecycle(&arguments[2], std::path::Path::new(&arguments[4]))
            .is_err()
        {
            eprintln!("Live lifecycle endpoint unavailable");
            std::process::exit(1);
        }
        return;
    }
    if arguments != ["--fixture-stdio"] {
        eprintln!(
            "Usage: sentinel-agent --fixture-stdio | --live-lifecycle --pipe <local-name> --journal <selected-file>"
        );
        std::process::exit(2);
    }
    if let Err(error) = serve_once(&mut std::io::stdin().lock(), &mut std::io::stdout().lock()) {
        eprintln!("Fixture request failed: {error:?}");
        std::process::exit(1);
    }
}
