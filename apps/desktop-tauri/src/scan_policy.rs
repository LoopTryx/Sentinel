/// A verdict string alone does not prove completed inspection.
pub fn confirmed_clean(state: &str, verdict: &str, content_complete: bool) -> bool {
    state == "completed" && verdict == "clean" && content_complete
}

pub fn complete_scope<'a>(reports: impl Iterator<Item = (&'a str, bool)>) -> bool {
    let mut observed = false;
    for (state, complete) in reports {
        observed = true;
        if state != "completed" || !complete {
            return false;
        }
    }
    observed
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn unknown_and_incomplete_states_are_never_clean() {
        for state in [
            "failed",
            "access_error",
            "partial",
            "cancelled",
            "timed_out",
            "changed",
            "engine_failed",
            "busy",
            "unsupported",
        ] {
            assert!(!confirmed_clean(state, "clean", true));
            assert!(!confirmed_clean(state, "unknown", false));
        }
        assert!(!confirmed_clean("completed", "unknown", true));
        assert!(!confirmed_clean("completed", "clean", false));
        assert!(confirmed_clean("completed", "clean", true));
    }

    #[test]
    fn summary_completion_requires_nonempty_complete_reports() {
        assert!(!complete_scope(std::iter::empty()));
        assert!(complete_scope([("completed", true)].into_iter()));
        assert!(!complete_scope(
            [("completed", true), ("depth_limit", false)].into_iter()
        ));
        assert!(!complete_scope([("partial", false)].into_iter()));
    }
}
