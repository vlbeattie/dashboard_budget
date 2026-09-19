// A small, hand-curated, fully offline dictionary of well-known merchant/brand
// names mapped to this app's spending categories. This is public knowledge
// (national retail/restaurant/gas-station/airline chains, etc.) — no AI model,
// web service, or paid data source is used to build or apply it.
//
// This is a *fallback* layer used only when a transaction's own historical
// data (js/category-rules.js, derived from data/transactions.json) doesn't
// already recognize the merchant — see js/categorize.js.
//
// Keep entries lowercase. Prefer the most distinctive part of a brand name
// (e.g. "chick-fil-a" rather than "chick"), and only add a generic single word
// when it's unlikely to collide with an unrelated merchant.

export const MERCHANT_KEYWORDS = [
  {
    category: "Groceries",
    keywords: [
      "whole foods market", "trader joe's", "trader joes", "harris teeter",
      "royal farms", "food lion", "stop & shop", "winn-dixie", "winn dixie",
      "sprouts farmers market", "the fresh market", "jewel-osco", "jewel osco",
      "acme markets", "market basket", "weis markets", "save-a-lot", "save a lot",
      "piggly wiggly", "ingles markets", "lowes foods", "king soopers",
      "smith's food and drug", "fred meyer", "food 4 less", "price chopper",
      "tops friendly markets", "hy-vee", "hyvee", "shoprite", "wegmans",
      "safeway", "albertsons", "publix", "kroger", "vons", "ralphs",
      "giant eagle", "giant food", "meijer", "aldi", "h-e-b", "heb",
      "sam's club", "sams club", "bj's wholesale", "bjs wholesale",
      "wawa", "sheetz", "7-eleven", "7 eleven", "circle k", "quiktrip",
      "casey's general store", "kwik trip", "racetrac",
    ],
  },
  {
    category: "Restaurants & Dining",
    keywords: [
      "chick-fil-a", "chick fil a", "buffalo wild wings", "panera bread",
      "raising cane's", "raising canes", "jimmy john's", "jimmy johns",
      "jersey mike's", "jersey mikes", "panda express", "five guys",
      "in-n-out", "in n out", "olive garden", "cracker barrel",
      "waffle house", "shake shack", "dairy queen", "papa john's",
      "papa johns", "taco bell", "pizza hut", "wendy's", "wendys",
      "mcdonald's", "mcdonalds", "starbucks", "chipotle", "subway",
      "burger king", "domino's", "dominos", "sonic drive-in", "sonic",
      "culver's", "culvers", "applebee's", "applebees", "outback",
      "denny's", "dennys", "ihop", "popeyes", "arby's", "arbys", "kfc",
    ],
  },
  {
    category: "Travel-Lodging/Booking",
    keywords: [
      "delta air lines", "united airlines", "american airlines",
      "southwest airlines", "jetblue", "alaska airlines", "spirit airlines",
      "frontier airlines", "marriott", "hampton inn", "holiday inn",
      "best western", "hyatt", "hilton", "airbnb", "vrbo", "expedia",
      "booking.com", "priceline", "travelocity", "kayak",
      "enterprise rent-a-car", "national car rental", "hertz", "avis",
      "budget rent", "phillips 66", "costco gas", "exxonmobil", "exxon",
      "mobil", "chevron", "sunoco", "valero", "marathon", "conoco",
      "citgo", "speedway", "murphy usa", "flying j", "love's travel stop",
      "loves travel stop", "shell",
    ],
  },
  {
    category: "Transportation",
    keywords: ["amtrak", "septa", "e-zpass", "bart fare"],
  },
  {
    category: "Entertainment/Media",
    keywords: [
      "amc theatres", "regal cinemas", "cinemark", "stubhub", "fandango",
      "live nation", "ticketmaster",
    ],
  },
  {
    category: "Subscriptions-Software/Digital",
    keywords: [
      "netflix", "spotify", "disney+", "disney plus", "hbo max", "hulu",
      "adobe creative cloud", "microsoft 365",
    ],
  },
  {
    category: "Local/Misc",
    keywords: ["home depot", "ace hardware", "menards", "true value", "lowe's", "lowes"],
  },
  {
    category: "Automotive-Maintenance/Registration",
    keywords: [
      "autozone", "discount tire", "grease monkey", "valvoline", "meineke",
      "pep boys", "midas",
    ],
  },
  {
    category: "Health",
    keywords: ["walgreens", "rite aid"],
  },
  {
    category: "Insurance",
    keywords: [
      "liberty mutual", "nationwide insurance", "farmers insurance",
      "progressive insurance", "travelers insurance", "usaa",
    ],
  },
  {
    category: "Utilities/Lawn Service",
    keywords: [
      "spectrum", "centurylink", "cox communications", "national grid",
      "duke energy", "verizon", "t-mobile", "at&t",
    ],
  },
  {
    category: "Shopping-General Merchandise",
    keywords: [
      "dick's sporting goods", "office depot", "old navy", "tj maxx",
      "marshalls", "staples", "kohl's", "kohls", "ikea",
    ],
  },
  {
    category: "Card Fees/Credits/Interest",
    keywords: [
      "credit card payment", "finance charge", "transaction fee",
      "overdraft fee", "service fee", "atm fee", "payment received",
      "payment thank you",
    ],
  },
];
