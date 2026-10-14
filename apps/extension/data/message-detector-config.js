/** Editable local scoring policy. Rebuild and run scripts/evaluate-messages.mjs after changes. Scores are clues, not probabilities; domains are not certified safe. */
export const messageDetectorConfig = {
  "version": 1,
  "limits": {
    "characters": 4096,
    "urls": 12,
    "hostLength": 253,
    "labelLength": 63,
    "matchesPerCategory": 12
  },
  "thresholds": {
    "unknown": {
      "suspicious": 10,
      "likely": 18
    },
    "unsaved": {
      "suspicious": 8,
      "likely": 16
    },
    "saved": {
      "suspicious": 13,
      "likely": 21
    },
    "trusted": {
      "suspicious": 17,
      "likely": 25
    }
  },
  "bonuses": {
    "crossCategory": 2,
    "rewardActionUrgency": 4,
    "proximity": 2,
    "linkPressure": 6,
    "directRequest": 5,
    "firstTime": 1,
    "foreignCode": 1
  },
  "proximityWords": 8,
  "borderlineMargin": 2,
  "categoryCap": 7,
  "linkCap": 14,
  "categories": {
    "reward": {
      "label": "Reward bait",
      "reason": "Unexpected winnings or rewards are offered.",
      "terms": [
        "prize",
        "lottery",
        "winner",
        "reward",
        "free gift",
        "cash prize",
        "جائزة",
        "ربحت",
        "فزت",
        "مكافأة"
      ],
      "patterns": [
        "you (?:have )?won"
      ],
      "patternsNumeric": [
        "claim (?:your )?(?:free )?(?:price|cash|money|reward) (?:of )?s?\\d+s?"
      ]
    },
    "action": {
      "label": "Action demand",
      "reason": "The message asks you to act, claim, verify or send something.",
      "terms": [
        "claim",
        "click",
        "verify",
        "send",
        "transfer",
        "pay",
        "reply",
        "share",
        "give",
        "tell",
        "forward",
        "provide",
        "enter",
        "confirm",
        "lend",
        "افتح",
        "اضغط",
        "ارسل",
        "أرسل",
        "شارك",
        "اعطني",
        "أعطني",
        "حول",
        "ادفع",
        "تحقق",
        "طالب"
      ],
      "patterns": [
        "claim your",
        "verify your account"
      ]
    },
    "urgency": {
      "label": "Urgency",
      "reason": "Time pressure discourages independent verification.",
      "terms": [
        "urgent",
        "immediately",
        "act now",
        "last chance",
        "within minutes",
        "account suspended",
        "عاجل",
        "فورا",
        "فوراً",
        "الآن",
        "الان",
        "اخر فرصة",
        "آخر فرصة"
      ],
      "patterns": [
        "(?:in|within) \\d+ (?:minutes?|hours?)",
        "account (?:will be|is) (?:closed|blocked)"
      ]
    },
    "credentials": {
      "label": "Money or credentials",
      "reason": "Money, an access code or a password is mentioned; check the request independently.",
      "terms": [
        "otp",
        "password",
        "cvv",
        "pin",
        "processing fee",
        "delivery fee",
        "send money",
        "pay now",
        "رمز التحقق",
        "كلمة المرور",
        "كلمة السر",
        "ارسل المال",
        "أرسل المال",
        "رسوم"
      ],
      "patterns": [
        "(?:send|share|give|reply|tell|forward|provide|enter|confirm) (?:me |us |your |the |my |a |this )*(?:otp|password|pin|cvv|verification code|security code|login code|code|bank details)",
        "(?:send|transfer|lend|pay) (?:me |us |your |the |my |a |some )*(?:money|cash|funds)",
        "(?:ارسل|أرسل|شارك|اعطني|أعطني) (?:لي )?(?:رمز|كلمة|المال)",
        "(?:حول|حوّل|ادفع) (?:لي )?(?:مبلغ|مال|\\d+)"
      ]
    },
    "authority": {
      "label": "Authority claim",
      "reason": "The message claims a bank, service, support team or official role; identity is unverified.",
      "terms": [
        "bank",
        "support team",
        "account team",
        "police",
        "government",
        "microsoft",
        "paypal",
        "amazon",
        "apple",
        "البنك",
        "الدعم",
        "الشرطة",
        "الحكومة"
      ],
      "patterns": []
    }
  },
  "weights": {
    "reward": 4,
    "action": 2,
    "urgency": 3,
    "credentials": 3,
    "authority": 2,
    "link": 3,
    "shortener": 5,
    "suspiciousTld": 5,
    "lookalike": 7,
    "embeddedCredentials": 6,
    "ipHost": 5,
    "internationalized": 4,
    "amount": 1,
    "phone": 1
  },
  "requestPatterns": [
    "(?:send|share|give|reply|tell|forward|provide|enter|confirm) (?:me |us |your |the |my |a |this )*(?:otp|password|pin|cvv|verification code|security code|login code|code|bank details)",
    "(?:send|transfer|lend|pay) (?:me |us |your |the |my |a |some )*(?:money|cash|funds)",
    "(?:ارسل|أرسل|شارك|اعطني|أعطني) (?:لي )?(?:رمز|كلمة|المال)",
    "(?:حول|حوّل|ادفع) (?:لي )?(?:مبلغ|مال|\\d+)"
  ],
  "numericRequestPatterns": [
    "(?:send|transfer|lend|pay) (?:me |us |your |the |my |a |some )*\\d+",
    "(?:ارسل|أرسل|حول|ادفع) (?:لي )?\\d+"
  ],
  "negatedRequests": [
    "(?:do not|dont|never) (?:ever )?(?:send|share|give|reply|tell|forward|provide|enter|confirm) (?:anyone |me |us |your |the |my |a |this )*(?:otp|password|pin|cvv|verification code|security code|login code|code|bank details|money|\\d+)",
    "(?:لا ترسل|لا تشارك) (?:رمز التحقق|كلمة المرور|كلمة السر|المال)"
  ],
  "shorteners": [
    "bit.ly",
    "tinyurl.com",
    "t.co",
    "is.gd",
    "shorturl.at",
    "cutt.ly",
    "rb.gy"
  ],
  "suspiciousTlds": [
    "zip",
    "mov",
    "top",
    "click",
    "xyz",
    "work"
  ],
  "brands": [
    {
      "name": "paypal",
      "domains": [
        "paypal.com"
      ]
    },
    {
      "name": "microsoft",
      "domains": [
        "microsoft.com",
        "live.com",
        "office.com"
      ]
    },
    {
      "name": "apple",
      "domains": [
        "apple.com",
        "icloud.com"
      ]
    },
    {
      "name": "amazon",
      "domains": [
        "amazon.com",
        "amazon.co.uk"
      ]
    },
    {
      "name": "whatsapp",
      "domains": [
        "whatsapp.com"
      ]
    },
    {
      "name": "google",
      "domains": [
        "google.com"
      ]
    }
  ],
  "maxBrandDistance": 1,
  "legacyEventCodes": {
    "reward": "reward",
    "action": "pressure",
    "urgency": "pressure",
    "credentials": "credentials",
    "link": "link"
  }
};
