use regex::Regex;

pub fn parse_whatsapp(text: &str) -> Vec<(String, Option<String>, Option<String>)> {
    let mut processed = Vec::new();

    let ios_re =
        Regex::new(r"^\[(\d{1,2}/\d{1,2}/\d{2,4}, \d{1,2}:\d{2}:\d{2})\] (.*?): (.*)").unwrap();

    let android_re =
        Regex::new(r"^(\d{1,2}/\d{1,2}/\d{2,4}, \d{1,2}:\d{2}) - (.*?): (.*)").unwrap();

    let mut current_msg: Option<(String, String, String)> = None;

    for line in text.lines() {
        if let Some(caps) = ios_re.captures(line) {
            if let Some((date, sender, content)) = current_msg.take() {
                processed.push((content, Some(sender), Some(date)));
            }
            current_msg = Some((
                caps[1].to_string(),
                caps[2].to_string(),
                caps[3].to_string(),
            ));
        } else if let Some(caps) = android_re.captures(line) {
            if let Some((date, sender, content)) = current_msg.take() {
                processed.push((content, Some(sender), Some(date)));
            }
            current_msg = Some((
                caps[1].to_string(),
                caps[2].to_string(),
                caps[3].to_string(),
            ));
        } else {
            let is_date_start = Regex::new(r"^\[?\d{1,2}/\d{1,2}/\d{2,4}")
                .unwrap()
                .is_match(line);

            if !is_date_start {
                if let Some((_, _, ref mut content)) = current_msg {
                    content.push('\n');
                    content.push_str(line);
                }
            }
        }
    }

    if let Some((date, sender, content)) = current_msg {
        processed.push((content, Some(sender), Some(date)));
    }

    processed
}

pub fn is_whatsapp_export(content: &str) -> bool {
    if content.len() > 500 {
        let preview = &content[..500];

        let ios_re = Regex::new(r"\[\d{1,2}/\d{1,2}/\d{2,4}, \d{1,2}:\d{2}:\d{2}\]").unwrap();
        let android_re = Regex::new(r"\d{1,2}/\d{1,2}/\d{2,4}, \d{1,2}:\d{2} -").unwrap();
        ios_re.is_match(preview) || android_re.is_match(preview)
    } else {
        false
    }
}
