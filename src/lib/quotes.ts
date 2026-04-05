export interface FinancialQuote {
  text:   string;
  source: string;
  type:   "bible" | "guan";
}

export const FINANCIAL_QUOTES: FinancialQuote[] = [
  // ── 聖經 ──────────────────────────────────────────────────────────────────
  {
    text:   "用虛謊之法得來的財寶，必然消耗；勤勞積蓄的，必見加增。",
    source: "箴言 13:11",
    type:   "bible",
  },
  {
    text:   "富戶管轄窮人；欠債的是債主的僕人。",
    source: "箴言 22:7",
    type:   "bible",
  },
  {
    text:   "智慧人家中積有寶物和膏油；愚昧人隨得隨吞。",
    source: "箴言 21:20",
    type:   "bible",
  },
  {
    text:   "貪愛銀子的，不因得銀子知足；貪愛豐富的，也不因得利益知足。這也是虛空。",
    source: "傳道書 5:10",
    type:   "bible",
  },
  {
    text:   "一個人不能事奉兩個主。你們不能又事奉神，又事奉瑪門（財利）。",
    source: "馬太福音 6:24",
    type:   "bible",
  },
  {
    text:   "敬虔加上知足的心便是大利了；因為我們沒有帶甚麼到世上來，也不能帶甚麼去。",
    source: "提摩太前書 6:6-7",
    type:   "bible",
  },
  {
    text:   "人在最小的事上忠心，在大事上也忠心；在最小的事上不義，在大事上也不義。",
    source: "路加福音 16:10",
    type:   "bible",
  },
  {
    text:   "有人散財，卻更增添；有人過度吝嗇，反致窮乏。好施捨的，必得豐裕；滋潤人的，必得滋潤。",
    source: "箴言 11:24-25",
    type:   "bible",
  },
  {
    text:   "你這又良善又忠心的僕人，你在不多的事上有忠心，我要把許多事派你管理。",
    source: "馬太福音 25:21",
    type:   "bible",
  },
  {
    text:   "懶惰人哪，你去察看螞蟻的動作，就可得智慧。螞蟻在夏天預備食物，在收割時聚斂糧食。",
    source: "箴言 6:6-8",
    type:   "bible",
  },
  {
    text:   "你們哪一個要蓋一座樓，不先坐下算計花費，能蓋成不能呢？",
    source: "路加福音 14:28",
    type:   "bible",
  },
  {
    text:   "你要勤知道你羊群的狀況，留心料理你的牛群；因為資財不能永有。",
    source: "箴言 27:23-24",
    type:   "bible",
  },
  {
    text:   "你要記念耶和華你的神，因為得貨財的力量是他給你的。",
    source: "申命記 8:18",
    type:   "bible",
  },
  {
    text:   "你要以財物，並一切初熟的土產，尊榮耶和華。這樣，你的倉房必充滿有餘。",
    source: "箴言 3:9-10",
    type:   "bible",
  },
  {
    text:   "不可為自己積攢財寶在地上，地上有蟲子咬，能銹壞，也有賊挖窟窿來偷。",
    source: "馬太福音 6:19",
    type:   "bible",
  },
  {
    text:   "你的財寶在哪裡，你的心也在那裡。",
    source: "馬太福音 6:21",
    type:   "bible",
  },
  {
    text:   "謀略不足，所謀必敗；謀士眾多，所謀必成。",
    source: "箴言 15:22",
    type:   "bible",
  },
  {
    text:   "殷勤的手必掌權；懶惰的人必服苦。",
    source: "箴言 12:24",
    type:   "bible",
  },
  {
    text:   "凡你手所當做的事要盡力去做；因為在你所必去的陰間沒有工作，沒有謀算，沒有知識，也沒有智慧。",
    source: "傳道書 9:10",
    type:   "bible",
  },
  {
    text:   "人因多得益處，這有甚麼好處呢？吃這些的，不過是眼睛看看而已。",
    source: "傳道書 5:11",
    type:   "bible",
  },

  // ── 關聖帝君 ──────────────────────────────────────────────────────────────
  {
    text:   "積善在身，猶長日加益，而人不知也；積惡在身，猶火之消膏，而人不見也。",
    source: "關聖帝君覺世真經",
    type:   "guan",
  },
  {
    text:   "人心好善，雖未行善，福神已隨之；人心好惡，雖未行惡，禍神已隨之。",
    source: "關聖帝君覺世真經",
    type:   "guan",
  },
  {
    text:   "勿以善小而不為，勿以惡小而為之。",
    source: "關聖帝君聖訓",
    type:   "guan",
  },
  {
    text:   "錢財乃身外之物，生不帶來，死不帶去，取之有道，用之有節，方為正道。",
    source: "關聖帝君訓示",
    type:   "guan",
  },
  {
    text:   "義者，宜也，各得其宜之謂義。取財合義，用財盡義，此忠義之道也。",
    source: "關聖帝君聖訓",
    type:   "guan",
  },
  {
    text:   "行善必昌，行善不昌，祖上必有餘殃；行惡必殃，行惡不殃，祖上必有餘德。",
    source: "關聖帝君覺世真經",
    type:   "guan",
  },
  {
    text:   "信為立身之本，義為處世之道。財以信積，業以義守。",
    source: "關聖帝君聖訓",
    type:   "guan",
  },
  {
    text:   "天道無親，常與善人。勤儉積德，天必佑之。",
    source: "關聖帝君訓示",
    type:   "guan",
  },
  {
    text:   "一念之差，禍福攸分；量入為出，家業乃安。",
    source: "關聖帝君聖訓",
    type:   "guan",
  },
  {
    text:   "人非聖賢，孰能無過；過而能改，善莫大焉。負債知省，必能翻身。",
    source: "關聖帝君訓示",
    type:   "guan",
  },
  {
    text:   "忠義傳家久，勤儉繼世長。節衣縮食非吝嗇，乃為後代留餘地。",
    source: "關聖帝君聖訓",
    type:   "guan",
  },
  {
    text:   "不義之財，如水上浮萍，得之易，失之亦易；義財誠信，方能長久。",
    source: "關聖帝君訓示",
    type:   "guan",
  },
  {
    text:   "凡事豫則立，不豫則廢。理財亦然，有計有算，方能富足。",
    source: "關聖帝君聖訓",
    type:   "guan",
  },
  {
    text:   "萬貫家財，不如薄技在身；薄技在身，不如廣積陰德。",
    source: "關聖帝君訓示",
    type:   "guan",
  },
  {
    text:   "人能克己，方能成事。欲望無窮，財再多亦不足；知足常樂，分文亦是富翁。",
    source: "關聖帝君聖訓",
    type:   "guan",
  },
];

/**
 * 依日期決定當日箴言（每天自動換，同一天同一則）
 */
export function getDailyQuote(): FinancialQuote {
  const day = Math.floor(Date.now() / 86_400_000); // days since epoch
  return FINANCIAL_QUOTES[day % FINANCIAL_QUOTES.length];
}

/**
 * 隨機取一則（排除當前這則）
 */
export function getRandomQuote(exclude?: FinancialQuote): FinancialQuote {
  const pool = exclude
    ? FINANCIAL_QUOTES.filter(q => q.text !== exclude.text)
    : FINANCIAL_QUOTES;
  return pool[Math.floor(Math.random() * pool.length)];
}
