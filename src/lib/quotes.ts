export interface FinancialQuote {
  text:   string;
  source: string;
  type:   "bible" | "guan" | "wenchang" | "buddha";
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

  // ── 文昌帝君 ──────────────────────────────────────────────────────────────
  {
    text:   "救人之難，濟人之急，憫人之孤，容人之過；廣行陰騭，上格蒼穹。",
    source: "文昌帝君陰騭文",
    type:   "wenchang",
  },
  {
    text:   "存心不善，風水無益；父母不孝，奉神無益；兄弟不和，交友無益；行止不端，讀書無益。",
    source: "文昌帝君四戒",
    type:   "wenchang",
  },
  {
    text:   "諸惡莫作，眾善奉行；己所不欲，勿施於人。積德雖無人見，行善自有天知。",
    source: "文昌帝君訓示",
    type:   "wenchang",
  },
  {
    text:   "勤讀書，莫苟求；以才學換前程，以品德立家業，方為正道。",
    source: "文昌帝君訓示",
    type:   "wenchang",
  },
  {
    text:   "廣行陰騭，天必賜福；勤儉持家，財源自旺。積善之家，必有餘慶。",
    source: "文昌帝君陰騭文",
    type:   "wenchang",
  },
  {
    text:   "惜福用財，廣結善緣；一分耕耘，一分收穫。財從勤中來，德從善中積。",
    source: "文昌帝君訓示",
    type:   "wenchang",
  },
  {
    text:   "量力而為，借貸需謹慎；知恩圖報，還債莫拖延。信義乃立身之本。",
    source: "文昌帝君訓示",
    type:   "wenchang",
  },
  {
    text:   "學問乃無形之財，技能乃不盡之寶；勤奮精進，富貴自隨。",
    source: "文昌帝君聖訓",
    type:   "wenchang",
  },
  {
    text:   "敬業勤學，積財有道；量入為出，方保長久。財可養命，德可安家。",
    source: "文昌帝君聖訓",
    type:   "wenchang",
  },
  {
    text:   "心存善念，處事公正；取財有道，散財有義。如此者，福祿綿長。",
    source: "文昌帝君陰騭文",
    type:   "wenchang",
  },

  // ── 佛教 ──────────────────────────────────────────────────────────────────
  {
    text:   "以正當之業謀生，以勤儉之道積財，以布施之心散財；三者具足，名曰善財。",
    source: "佛教正命之道",
    type:   "buddha",
  },
  {
    text:   "財物有五分：一分自養，一分供養父母師長，一分廣結善緣，一分儲備急用，一分種福布施。",
    source: "善生經（Sigalovada Sutta）",
    type:   "buddha",
  },
  {
    text:   "少欲者，雖無多財，心常富足；多欲者，雖擁萬貫，心常貧乏。少欲知足，是名真富。",
    source: "佛遺教經",
    type:   "buddha",
  },
  {
    text:   "貪欲如火，越添越旺，終焚其身；知足如水，隨器而安，處處滋潤。",
    source: "佛陀教示",
    type:   "buddha",
  },
  {
    text:   "布施如播種，廣種福田者，福報自然豐收；吝嗇不施，如荒田不耕，何以有穫？",
    source: "佛陀教示",
    type:   "buddha",
  },
  {
    text:   "財物為眾緣和合，聚散離合皆無常；善用財物利己利人，方不辜負此生因緣。",
    source: "雜阿含經",
    type:   "buddha",
  },
  {
    text:   "欲知前世因，今生受者是；欲知來世果，今生作者是。勤種善因，自得善果。",
    source: "三世因果經",
    type:   "buddha",
  },
  {
    text:   "布施得財富，持戒得安樂，忍辱得尊貴，精進得成就。四攝法行，事業自昌。",
    source: "佛教四攝法",
    type:   "buddha",
  },
  {
    text:   "人之所以貧，非因財不足，乃因心不足。心足則萬物足，心貪則萬物缺。",
    source: "佛陀教示",
    type:   "buddha",
  },
  {
    text:   "如理作意，正命謀生；不欺不詐，財富清淨。清淨之財，方能長久護持家業。",
    source: "八正道—正命",
    type:   "buddha",
  },
  {
    text:   "眾生畏果，菩薩畏因。謹慎每一筆支出，即是對未來財富的護念。",
    source: "佛教因果觀",
    type:   "buddha",
  },
  {
    text:   "一念貪心起，萬劫難回頭；一念施捨心，福報無量無邊。財施、法施、無畏施，三施齊修。",
    source: "地藏菩薩本願經",
    type:   "buddha",
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
