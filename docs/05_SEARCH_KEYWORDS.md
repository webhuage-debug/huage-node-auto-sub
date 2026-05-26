# 05 搜索关键词

## 文档目的

记录节点采集使用的搜索关键词、协议关键词和排除关键词。

## 当前版本范围

当前关键词由 `config/search_keywords.json` 管理，后端采集接口会读取其中的 `github_search_keywords` 执行有限 GitHub 线索搜索。

本版本不会根据 `protocol_keywords` 解析节点，只保留为后续节点解析版本使用。

## 后续待补充内容

补充关键词评分、轮询顺序、冷却策略和误报排除规则。
