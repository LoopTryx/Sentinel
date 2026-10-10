//! Bounded static byte evidence. Findings are clues, never malware verdicts.

#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize)]
pub struct ContentEvidence {
    pub inspected_bytes: u64,
    pub logical_bytes: u64,
    pub complete: bool,
    pub zero_bytes: u64,
    pub zero_permille: u16,
    pub mostly_empty_large_file: bool,
    pub executable_header: bool,
}

pub fn inspect_content(bytes: &[u8], logical_bytes: u64) -> ContentEvidence {
    let zero_bytes = bytes.iter().filter(|&&byte| byte == 0).count() as u64;
    let zero_permille = if bytes.is_empty() {
        0
    } else {
        (u128::from(zero_bytes) * 1000 / bytes.len() as u128) as u16
    };
    let executable_header = bytes.starts_with(b"MZ")
        && bytes.get(60..64).is_some_and(|offset| {
            let offset = u32::from_le_bytes(offset.try_into().expect("four-byte slice")) as usize;
            offset >= 64
                && offset
                    .checked_add(4)
                    .is_some_and(|end| bytes.get(offset..end) == Some(b"PE\0\0"))
        });
    ContentEvidence {
        inspected_bytes: bytes.len() as u64,
        logical_bytes,
        complete: bytes.len() as u64 == logical_bytes,
        zero_bytes,
        zero_permille,
        // This describes the inspected range only; a large sparse disk image
        // may be entirely legitimate. Do not infer allocation or auto-remediate.
        mostly_empty_large_file: logical_bytes >= 64 * 1024 * 1024
            && bytes.len() >= 4096
            && zero_permille >= 950,
        executable_header,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn large_zero_filled_sample_reports_exact_partial_evidence() {
        let evidence = inspect_content(&[0; 4096], 1024 * 1024 * 1024);
        assert_eq!(evidence.zero_bytes, 4096);
        assert_eq!(evidence.zero_permille, 1000);
        assert!(evidence.mostly_empty_large_file);
        assert!(!evidence.complete);
        assert_eq!(evidence.inspected_bytes, 4096);
    }

    #[test]
    fn small_zero_file_and_empty_sample_do_not_flag_large_padding() {
        let evidence = inspect_content(&[0; 4096], 4096);
        assert!(evidence.complete);
        assert!(!evidence.mostly_empty_large_file);
        assert!(!inspect_content(&[], u64::MAX).mostly_empty_large_file);
    }

    #[test]
    fn header_check_needs_pe_signature_and_bounded_offset() {
        let mut pe = [0u8; 128];
        pe[..2].copy_from_slice(b"MZ");
        pe[60..64].copy_from_slice(&64u32.to_le_bytes());
        pe[64..68].copy_from_slice(b"PE\0\0");
        assert!(inspect_content(&pe, 128).executable_header);
        pe[60..64].copy_from_slice(&u32::MAX.to_le_bytes());
        assert!(!inspect_content(&pe, 128).executable_header);
        assert!(!inspect_content(b"MZ ordinary text", 16).executable_header);
    }

    #[test]
    fn ordinary_data_has_no_padding_or_header_clue() {
        let bytes: Vec<u8> = (1..=255).cycle().take(4096).collect();
        let evidence = inspect_content(&bytes, 1024 * 1024 * 1024);
        assert_eq!(evidence.zero_permille, 0);
        assert!(!evidence.mostly_empty_large_file);
        assert!(!evidence.executable_header);
    }
}
