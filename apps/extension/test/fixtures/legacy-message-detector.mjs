export function legacyExplainMessage(input) {
 if(typeof input!=='string' || input.length>4096) throw new Error('Use an invented message of at most 4096 characters.');
 // A contextual cash-claim phrase also catches "price" used in place of prize.
 // A bare price/currency amount is not enough to raise this clue.
 const cashClaim=/\bclaim\s+(?:your\s+)?(?:free\s+)?(?:price|cash|money|reward)\s+(?:of\s+)?(?:[$€£]\s*\d|\d+(?:[.,]\d+)?\s*[$€£])/i;
 const patterns=[[/\b(urgent|immediately|act now|last chance)\b/i,'pressure','Urgency can pressure you into acting before verification.'],[/\b(otp|password|cvv|pin|verify your account)\b/i,'credentials','Requests for secrets require independent verification through the official service.'],[/\b(send money|processing fee|delivery fee|pay now)\b/i,'payment','Unexpected payment requests need verification outside this message.'],[/\b(winner|lottery|free gift|prize)\b/i,'reward','Unexpected rewards can be bait; verify the offer independently.'],[/http:\/\/|bit\.ly\/|tinyurl\.com\//i,'link','An insecure or shortened link hides useful destination information. Inspect the expanded official destination independently.']];
 const reasons=patterns.filter(([pattern,code])=>pattern.test(input)||(code==='reward'&&cashClaim.test(input))).map(([,code,text])=>({code,text}));
 return {risk:reasons.length?'suspicious':'unknown',coverage:'partial',reasons,networkAccessed:false};
}
