use shield_agent::stdio::serve_once;

fn main() {
    if std::env::args().skip(1).collect::<Vec<_>>() != ["--fixture-stdio"] {
        eprintln!("Usage: shield-agent --fixture-stdio (fixture data only)");
        std::process::exit(2);
    }
    if let Err(error) = serve_once(&mut std::io::stdin().lock(), &mut std::io::stdout().lock()) {
        eprintln!("Fixture request failed: {error:?}");
        std::process::exit(1);
    }
}
