# CSV 銀行 Adapter 對應表

| 代碼 | 銀行 | 備註 |
|------|------|------|
| `tbank` | 台灣銀行 | 民國年，Big5 |
| `cathay_bank` | 國泰世華存款 | |
| `esun_bank` | 玉山銀行存款 | CSV / XLS |
| `ctbc_bank` | 中國信託存款 | 民國年 1130328，Big5 |
| `kgi_bank` | 凱基銀行存款 | TXT 固定寬度格式 |
| `mega_bank` | 兆豐銀行存款 | |
| `sinopac_bank` | 永豐銀行存款 | |
| `yuanta_bank` | 元大銀行存款 | |
| `cathay_cc` | 國泰世華信用卡 | |
| `esun_cc` | 玉山信用卡 | |
| `ctbc_cc` | 中信信用卡 | Big5 |
| `taishin_cc` | 台新信用卡 | |
| `sinopac_cc` | 永豐信用卡 | PDF（AI 解析） |

## Adapter 位置
`src/lib/csv/adapters/`

新增 adapter 請用 `/new-bank-adapter` skill。
