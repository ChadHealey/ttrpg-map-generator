const INVALID: u8 = u8::MAX;
const ALPHABET: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

pub(crate) fn encode_base64(bytes: &[u8]) -> String {
    let mut result = String::with_capacity(bytes.len().div_ceil(3) * 4);
    for chunk in bytes.chunks(3) {
        let first = chunk[0];
        let second = chunk.get(1).copied().unwrap_or(0);
        let third = chunk.get(2).copied().unwrap_or(0);
        result.push(char::from(ALPHABET[usize::from(first >> 2)]));
        result.push(char::from(
            ALPHABET[usize::from(((first & 3) << 4) | (second >> 4))],
        ));
        result.push(if chunk.len() > 1 {
            char::from(ALPHABET[usize::from(((second & 15) << 2) | (third >> 6))])
        } else {
            '='
        });
        result.push(if chunk.len() > 2 {
            char::from(ALPHABET[usize::from(third & 63)])
        } else {
            '='
        });
    }
    result
}

pub(crate) fn decode_canonical_base64(value: &str, maximum_bytes: usize) -> Result<Vec<u8>, ()> {
    let source = value.as_bytes();
    if !source.len().is_multiple_of(4) {
        return Err(());
    }
    let padding = if source.ends_with(b"==") {
        2
    } else if source.ends_with(b"=") {
        1
    } else {
        0
    };
    let decoded_length = source
        .len()
        .checked_div(4)
        .and_then(|groups| groups.checked_mul(3))
        .and_then(|length| length.checked_sub(padding))
        .ok_or(())?;
    if decoded_length > maximum_bytes {
        return Err(());
    }
    let mut result = Vec::with_capacity(decoded_length);
    for (group_index, group) in source.chunks_exact(4).enumerate() {
        let is_last = group_index + 1 == source.len() / 4;
        let first = sextet(group[0]);
        let second = sextet(group[1]);
        let third = if group[2] == b'=' {
            0
        } else {
            sextet(group[2])
        };
        let fourth = if group[3] == b'=' {
            0
        } else {
            sextet(group[3])
        };
        if first == INVALID || second == INVALID || third == INVALID || fourth == INVALID {
            return Err(());
        }
        if (!is_last && (group[2] == b'=' || group[3] == b'='))
            || (group[2] == b'=' && group[3] != b'=')
            || (padding == 2 && (second & 15) != 0)
            || (padding == 1 && (third & 3) != 0)
        {
            return Err(());
        }
        result.push((first << 2) | (second >> 4));
        if result.len() < decoded_length {
            result.push(((second & 15) << 4) | (third >> 2));
        }
        if result.len() < decoded_length {
            result.push(((third & 3) << 6) | fourth);
        }
    }
    Ok(result)
}

fn sextet(value: u8) -> u8 {
    match value {
        b'A'..=b'Z' => value - b'A',
        b'a'..=b'z' => value - b'a' + 26,
        b'0'..=b'9' => value - b'0' + 52,
        b'+' => 62,
        b'/' => 63,
        _ => INVALID,
    }
}

#[cfg(test)]
mod tests {
    use super::{decode_canonical_base64, encode_base64};

    #[test]
    fn accepts_canonical_padding_and_rejects_aliases_or_limits() {
        assert_eq!(decode_canonical_base64("AQ==", 1), Ok(vec![1]));
        assert_eq!(decode_canonical_base64("AQI=", 2), Ok(vec![1, 2]));
        assert_eq!(decode_canonical_base64("AQID", 3), Ok(vec![1, 2, 3]));
        assert!(decode_canonical_base64("AR==", 1).is_err());
        assert!(decode_canonical_base64("AQ==", 0).is_err());
        assert_eq!(encode_base64(&[1, 2, 3]), "AQID");
    }
}
