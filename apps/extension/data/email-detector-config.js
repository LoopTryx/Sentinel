/** Email-only tuning data. Chat weights and thresholds are unchanged. */
export const emailDetectorConfig={
 version:1,
 thresholds:{unknown:13,firstTime:12,known:18,trusted:21,likely:24},
 bonuses:{combination:2,proximity:2,pressureLink:6,attachmentPressure:5,directRequest:7,changedBank:8,firstTime:1},
 limits:{text:12288,categoryCap:7,signals:24,links:64,attachments:20,senders:512,trusted:128,queue:16},
 proximityWords:10,
 semanticPatterns:{
  identityRequest:{label:'Request to confirm personal or account details',category:'credentials',weight:9,patterns:['(?:verify|confirm|update|validate|reenter|submit|provide|enter) (?:[\\p{L}\\p{N}]+ ){0,6}(?:account|identity|information|details|password|credentials|card|pin|code)','(?:account|identity|information|details|password|credentials) (?:[\\p{L}\\p{N}]+ ){0,6}(?:verification|required|confirm|update|validate)','(?:ارسل|أرسل|ادخل|أدخل|اكد|أكد|تحقق) (?:[\\p{L}\\p{N}]+ ){0,5}(?:حساب|حسابك|رمز|كود|كلمة المرور|بطاقة)']},
  paymentDirective:{label:'Request to send money or change payment instructions',category:'payment',weight:7,patterns:['(?:send|pay|wire|transfer|purchase|buy) (?:[\\p{L}\\p{N}]+ ){0,5}(?:money|funds|fee|deposit|gift cards|bitcoin|cryptocurrency)','(?:bank|payment|payroll) (?:[\\p{L}\\p{N}]+ ){0,4}(?:changed|updated|new beneficiary)']},
  accountThreatPattern:{label:'Account restriction or security threat',category:'accountThreat',weight:6,patterns:['(?:account|access|mailbox|service) (?:[\\p{L}\\p{N}]+ ){0,5}(?:suspend|suspended|blocked|restricted|disabled|expire|expires|terminated)','(?:avoid|prevent) (?:[\\p{L}\\p{N}]+ ){0,4}(?:suspension|closure|termination)']}
 },
 baseWeights:{reward:3,action:2,urgency:3,credentials:1,authority:1,link:0},
 categories:{
  emailAction:{label:'Action requested',weight:3,phrases:['click here','click below','log in','log on','update your','confirm your','download','complete the','follow the link','sign in']},
  emailCredentials:{label:'Personal or account information requested',weight:3,phrases:['credit card','social security','personal information','account information','pin number','online banking']},
  accountSecurity:{label:'Account security claim',weight:6,phrases:['account','banking','security','security update','security alert','account access','account verification','verify your identity','account has been','security measures','confirm your identity']},
  inheritance:{label:'Prize or inheritance bait',weight:4,phrases:['lucky draw','unclaimed funds','beneficiary','next of kin','you have been selected','claim your reward','inheritance','جائزة','ميراث']},
  advanceFee:{label:'Advance-fee proposal',weight:5,phrases:['urgent business proposal','transfer of funds','percentage share','trust fund','trustworthy partner','processing fee','رسوم مقدمة']},
  accountThreat:{label:'Account threat',weight:4,phrases:['verify your account','account suspended','unusual sign in','password expires','reactivate','mailbox almost full','avoid suspension','حسابك موقوف']},
  payment:{label:'Payment or invoice request',weight:3,phrases:['unauthorized transaction','payment failed','refund pending','updated bank details','overdue payment','unexpected invoice','رسوم غير مدفوعة']},
  delivery:{label:'Delivery payment request',weight:3,phrases:['package on hold','delivery failed','customs fee','reschedule delivery','unpaid shipping fee','delivery fee','طرد معلق']},
  government:{label:'Official or legal demand',weight:3,phrases:['traffic fine','tax refund','penalty','legal action','court notice','visa notice','immigration notice','غرامة']},
  recruitment:{label:'Job offer payment',weight:3,phrases:['work from home','no experience needed','onboarding fee','equipment purchase','check enclosed']},
  emergency:{label:'Emergency or donation request',weight:3,phrases:['stranded','hospital','urgent help','gift cards','donation','مساعدة عاجلة']},
  techExtortion:{label:'Support, extortion or crypto bait',weight:4,phrases:['virus detected','call this number','subscription renewed','i recorded you','bitcoin wallet','double your crypto']},
  business:{label:'Business payment pressure',weight:4,phrases:['are you available','urgent task','keep this confidential','change payroll','wire today','updated bank details']},
  pressure:{label:'Urgency',weight:3,phrases:['immediately','within 24 hours','final notice','act now','urgent','last chance','عاجل','فورا']},
  fear:{label:'Threat or fear',weight:2,phrases:['suspended','terminated','compromised','legal action']},
  secrecy:{label:'Secrecy',weight:3,phrases:['dont tell anyone','keep this confidential','secret transaction']},
  greeting:{label:'Generic greeting',weight:1,phrases:['dear customer','dear user','dear beneficiary']},
  unusualPayment:{label:'Unusual payment method',weight:4,phrases:['gift cards','bitcoin wallet','wire transfer','cryptocurrency','crypto payment']},
  grammar:{label:'Unusual template wording',weight:1,phrases:['dear esteem customer','your account have been','kindly do the needful']}
 },
 changedBankPatterns:['(?:updated|changed|new) bank details','change (?:the )?payroll','new beneficiary'],
 technicalWeights:{authentication:8,replyTo:3,brandSender:6,freeMailClaim:4,linkMismatch:7,riskyLink:5,loginPath:1,subdomains:2,brandPath:4,mixedScript:3,dangerousAttachment:6,doubleExtension:7,macroAttachment:4,htmlAttachment:4,passwordArchive:5,subjectStyle:1,shortBody:1,imageOnly:1,fakeThread:2},
 freeMail:['gmail.com','outlook.com','hotmail.com','yahoo.com','aol.com','proton.me'],
 companyClaims:['bank','paypal','microsoft','apple','amazon','google','government','support team'],
 attachmentExtensions:{executable:['exe','scr','js','vbs','bat','cmd','ps1','com','msi','jar','lnk'],macro:['docm','xlsm','pptm'],html:['html','htm','svg'],archive:['zip','rar','7z']},
 linkPolicy:{maxBrandDistance:1},
 linkPaths:['login','verify','secure','update','signin'],
 maxSubdomains:4,
 knownDirectRequestTier:'Suspicious'
};
