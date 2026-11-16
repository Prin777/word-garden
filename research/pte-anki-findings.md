# PTE Anki 来源检查（2026-11-10）

检查对象：https://github.com/Thanatos-Z/anki-pte-cards

## 结论
这是生成器加个人练习词表，不是已经验证完整、带美音的可直接使用卡包。未执行仓库代码。当前环境的直接网络下载失败，浏览工具成功读取了真实 CSV。

## 已验证
- input/words.csv 确实存在，表头为 word,phonetic,cn,example,example_cn。原始数据：https://raw.githubusercontent.com/Thanatos-Z/anki-pte-cards/main/input/words.csv
- 包含短中文释义及中英例句，结构可提取，但没有词性、英文详细定义或音频文件列。
- 数据质量存在问题：supported 的音标对应 support；members 的音标对应 member；a compound of 的音标仅 /ei/；projects 音标字段括号不完整。包含变形词和短语，不能直接作为标准词元词库。
- README 说明音标主要为英式风格、有道来源，TTS 为 edge-tts。与统一美音要求不完全一致。
- README 将 output/vocab.apkg 描述为运行生成器后的输出，顶层文件列表没有现成 output 或 media 目录。

## 未验证
- 未获得真实 apkg 或音频，不能确认音频覆盖率、口音、音质。
- Releases 页面读取失败，不能断言不存在发布附件。
- 顶层文件列表未见 LICENSE；不能视为已获得再分发授权。释义、例句和 TTS 使用许可亦需核实。

## 建议
可作为字段与质量检查样本，不能直接认定为正式 PTE 基础词库。后续需寻找含媒体的真实 apkg，或选择已核实来源的词表，再补充经许可的美音和释义。
