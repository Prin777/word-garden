# Anki 词库样本核验

日期：2026-11-10。只读取数据，未执行第三方生成器。

## IELTS

来源：https://github.com/huangzhenghz/Anki-IELTS/releases/tag/v1.0.0

实际下载并以只读方式检查 apkg 内 SQLite 数据及媒体映射。

```json
{
  "notes": 3611,
  "uniqueWords": 3610,
  "missingIPA": 17,
  "missingChinese": 0,
  "missingEnglish": 28,
  "missingAudioReference": 0,
  "missingAudioFile": 0
}
```

字段：Word、Phonetic symbol、Audio、Definition_EN、Definition_ZH、Example、Picture、Parts of Speech、Tag。

所有音频引用均在媒体映射中找到；尚未逐个解码或听音验证。美音一致性未确认。源码中 TTS 默认 en-US-AvaNeural，但不能因此认定已有词典音频全部美音。英文释义存在多个词义拼接，中文核心释义需整理，例句包含 HTML 实体。

样本 emperor：/ˈem.pɚ.ɚ/；皇帝；君主；英文释义 a male ruler of an empire。

许可：作者声明源码 MIT 不覆盖第三方词表、释义、音频及生成卡包；仅供个人学习，不公开分发。来源 https://github.com/huangzhenghz/Anki-IELTS 。因此不将此卡包作为可随公开镜像或 APK 分发的已授权数据。

## PTE

见 pte-anki-findings.md。当前候选尚不能作为完整美音 PTE 词库采用。

## 建议

IELTS 样本可用于验证字段转换与玩法；正式采用前补音标、整理核心释义、核对口音和内容来源。词库与音频作为独立数据保留，不默认打包进应用发布物。
