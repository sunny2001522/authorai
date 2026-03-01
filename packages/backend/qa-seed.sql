-- =============================================
-- Q&A 知識庫資料匯入
-- 執行前請確保 knowledge 表已有 category, subcategory 欄位
-- =============================================

-- 如果資料庫已存在，先新增欄位（安全執行）
ALTER TABLE knowledge ADD COLUMN IF NOT EXISTS category VARCHAR(50);
ALTER TABLE knowledge ADD COLUMN IF NOT EXISTS subcategory VARCHAR(100);
CREATE INDEX IF NOT EXISTS idx_knowledge_category ON knowledge(category);
CREATE INDEX IF NOT EXISTS idx_knowledge_subcategory ON knowledge(subcategory);

-- =============================================
-- 一、軟體技術 (technical)
-- =============================================

-- 1. App 指數不跳動、連線問題
INSERT INTO knowledge (author_id, type, title, content, category, subcategory, word_count, status)
SELECT id, 'text',
'App 指數不跳動、連線問題',
'Q: 指數靜止不動，開 4G 也一樣
A: 剛測試是正常的耶，還是您要試試其他網路呢？目前 iOS 指數不動工程師已在處理中。',
'technical', 'app_issue', 45, 'ready'
FROM authors WHERE slug = 'enru';

-- 2. iOS 系統 App 大盤指數靜止不動
INSERT INTO knowledge (author_id, type, title, content, category, subcategory, word_count, status)
SELECT id, 'text',
'iOS 系統 App 大盤指數靜止不動',
'Q: iOS 系統的 App 大盤指數靜止不動，換網路也沒用？
A: 工程師已在排查 iOS 連線問題，這屬於已知 Bug 正在修復中。',
'technical', 'app_issue', 40, 'ready'
FROM authors WHERE slug = 'enru';

-- 3. App 亮紅燈綠燈是什麼意思
INSERT INTO knowledge (author_id, type, title, content, category, subcategory, word_count, status)
SELECT id, 'text',
'App 亮紅燈綠燈是什麼意思',
'Q: App 裡面亮紅燈、綠燈是什麼意思？要買 Plus 版嗎？
A: 那是代表漲跌停，一般版本就能看到，不需要額外購買 Plus。',
'technical', 'app_issue', 35, 'ready'
FROM authors WHERE slug = 'enru';

-- 4. PC 版理財寶更新後導致軟體失效
INSERT INTO knowledge (author_id, type, title, content, category, subcategory, word_count, status)
SELECT id, 'text',
'PC 版理財寶更新後導致軟體失效',
'Q: PC 版理財寶更新後導致聚寶盆軟體失效怎麼辦？
A: 可能為版本相容性 Bug。建議先不要更新另一台電腦，出問題的請在上班日聯繫技術客服遠端。',
'technical', 'pc_issue', 50, 'ready'
FROM authors WHERE slug = 'enru';

-- 5. 長線聚寶盆打開後資料是空的
INSERT INTO knowledge (author_id, type, title, content, category, subcategory, word_count, status)
SELECT id, 'text',
'長線聚寶盆打開後資料是空的',
'Q: 長線聚寶盆打開沒資料？
A: 請點擊介面上的「預設篩選」按鈕，資料就會重新載入。',
'technical', 'data_error', 30, 'ready'
FROM authors WHERE slug = 'enru';

-- 6. 強棒電腦版文章要扣點數
INSERT INTO knowledge (author_id, type, title, content, category, subcategory, word_count, status)
SELECT id, 'text',
'強棒電腦版文章要扣點數',
'Q: 強棒電腦版文章以前能看，現在突然跳出要扣點數？
A: 這是後台設定錯誤。暫時解法是「先登入帳號」即可觀看，工程師會修正權限標籤。',
'technical', 'data_error', 45, 'ready'
FROM authors WHERE slug = 'enru';

-- 7. App 專業版授權在試用期結束後沒自動銜接
INSERT INTO knowledge (author_id, type, title, content, category, subcategory, word_count, status)
SELECT id, 'text',
'App 專業版授權在試用期結束後沒自動銜接',
'Q: App 專業版授權在試用期結束後沒自動銜接？
A: 先嘗試登出再重新登入，並確認登入帳號與購買帳號一致。若無效請進線客服。',
'technical', 'permission', 45, 'ready'
FROM authors WHERE slug = 'enru';

-- 8. 權限天數計算錯誤
INSERT INTO knowledge (author_id, type, title, content, category, subcategory, word_count, status)
SELECT id, 'text',
'權限天數計算錯誤',
'Q: 之前說處理好了，怎麼天數還是沒加上去？
A: 抱歉，小幫手這邊沒有權限看到您的後台權限，只能先麻煩您進線，請客服幫您查看。',
'technical', 'permission', 40, 'ready'
FROM authors WHERE slug = 'enru';

-- =============================================
-- 二、課程與購買 (course)
-- =============================================

-- 9. 重複購買相同方案被系統阻斷
INSERT INTO knowledge (author_id, type, title, content, category, subcategory, word_count, status)
SELECT id, 'text',
'重複購買相同方案被系統阻斷',
'Q: 重複購買相同方案被系統阻斷怎麼辦？
A: 同性質方案無法重疊。若要升級（如強棒轉強棒+聚寶盆），請找客服索取「購課限定」專屬連結。',
'course', 'payment', 50, 'ready'
FROM authors WHERE slug = 'enru';

-- 10. 想要買不同方案但系統阻斷
INSERT INTO knowledge (author_id, type, title, content, category, subcategory, word_count, status)
SELECT id, 'text',
'想要買不同方案但系統阻斷',
'Q: 我要買另一方案：強棒+聚寶盆，但不能買
A: 幫我找客服，我沒辦法在這裡貼購課同學限定的連結給你。講義第39頁有四個qrcode，左邊第一個是你要的。',
'course', 'payment', 55, 'ready'
FROM authors WHERE slug = 'enru';

-- 11. 購課後的軟體優惠價可以買幾次
INSERT INTO knowledge (author_id, type, title, content, category, subcategory, word_count, status)
SELECT id, 'text',
'購課後的軟體優惠價可以買幾次',
'Q: 購課後的軟體優惠價可以買幾次？
A: 優惠通常僅限一次，但到期時系統會以同樣的「續約價」自動續訂。',
'course', 'discount', 40, 'ready'
FROM authors WHERE slug = 'enru';

-- 12. 畫線班之後軟體會漲價嗎
INSERT INTO knowledge (author_id, type, title, content, category, subcategory, word_count, status)
SELECT id, 'text',
'畫線班之後軟體會漲價嗎',
'Q: 1/10 畫線班之後軟體會漲價嗎？
A: 確定有課後優惠，但 2 月起部分方案將取消優惠並調整價格，建議把握 1 月。',
'course', 'discount', 40, 'ready'
FROM authors WHERE slug = 'enru';

-- 13. 畫線班有課後優惠嗎
INSERT INTO knowledge (author_id, type, title, content, category, subcategory, word_count, status)
SELECT id, 'text',
'畫線班有課後優惠嗎',
'Q: 1/10 畫線班有課後優惠嗎？
A: 確定會有課後優惠唷，但價格還沒定案。建議先上完基礎 1、2、3 堂再來看畫線班比較好喔。',
'course', 'discount', 45, 'ready'
FROM authors WHERE slug = 'enru';

-- 14. 基礎課建議先上哪一堂
INSERT INTO knowledge (author_id, type, title, content, category, subcategory, word_count, status)
SELECT id, 'text',
'基礎課建議先上哪一堂',
'Q: 第 1、2、3 堂基礎課建議先上哪一堂？
A: 建議按順序上完 1、2、3 堂基礎後，再參加劃線班實作，學習效果最紮實。',
'course', 'content', 45, 'ready'
FROM authors WHERE slug = 'enru';

-- 15. 年度操盤手課程新手聽得懂嗎
INSERT INTO knowledge (author_id, type, title, content, category, subcategory, word_count, status)
SELECT id, 'text',
'年度操盤手課程新手聽得懂嗎',
'Q: 年度操盤手課程，新手小白聽得懂嗎？
A: 今年內容有特別調整，加入更多適合小白的基礎觀念，非常適合參加。',
'course', 'content', 40, 'ready'
FROM authors WHERE slug = 'enru';

-- 16. 極簡投資珍藏版書內容有更新嗎
INSERT INTO knowledge (author_id, type, title, content, category, subcategory, word_count, status)
SELECT id, 'text',
'極簡投資珍藏版書內容有更新嗎',
'Q: 新出的「極簡投資珍藏版」書，內容有更新嗎？
A: 內容與舊版一致，主要是封面改版，已有舊書的同學不需重複購買。',
'course', 'content', 40, 'ready'
FROM authors WHERE slug = 'enru';

-- 17. 美股課程太多單元要先看哪個
INSERT INTO knowledge (author_id, type, title, content, category, subcategory, word_count, status)
SELECT id, 'text',
'美股課程太多單元要先看哪個',
'Q: 美股課程太多單元，要先看哪一個？
A: 優先看「趨勢線」與「如何開戶」單元，這是操作的起點。',
'course', 'content', 35, 'ready'
FROM authors WHERE slug = 'enru';

-- 18. 台南實體班會有課後影音嗎
INSERT INTO knowledge (author_id, type, title, content, category, subcategory, word_count, status)
SELECT id, 'text',
'台南實體班會有課後影音嗎',
'Q: 台南實體班會有課後影音可以看嗎？
A: 實體班沒有影音回放。只有付費直播課才有 30 天以上的觀看權限。',
'course', 'schedule', 40, 'ready'
FROM authors WHERE slug = 'enru';

-- 19. 早鳥贈送的全軟體 7 天序號去哪裡領
INSERT INTO knowledge (author_id, type, title, content, category, subcategory, word_count, status)
SELECT id, 'text',
'早鳥贈送的全軟體 7 天序號去哪裡領',
'Q: 早鳥贈送的「全軟體 7 天序號」去哪裡領？
A: 根據課程不同，請洽詢小師妹或留意後台系統推播訊息。',
'course', 'schedule', 35, 'ready'
FROM authors WHERE slug = 'enru';

-- 20. 實體班當天可以請老師簽名嗎
INSERT INTO knowledge (author_id, type, title, content, category, subcategory, word_count, status)
SELECT id, 'text',
'實體班當天可以請老師簽名嗎',
'Q: 實體班當天可以請老師簽名嗎？
A: 可以喔！12:30-13:30 是簽名拍照時間。',
'course', 'schedule', 25, 'ready'
FROM authors WHERE slug = 'enru';

-- =============================================
-- 三、社群與入群 (community)
-- =============================================

-- 21. 申請美股 LINE 社群一直被駁回
INSERT INTO knowledge (author_id, type, title, content, category, subcategory, word_count, status)
SELECT id, 'text',
'申請美股 LINE 社群一直被駁回',
'Q: 申請美股 LINE 社群一直被駁回？
A: 必須填寫真實姓名與電話。若失敗，請嘗試在姓名電話間加「-」橫線。',
'community', 'join_group', 40, 'ready'
FROM authors WHERE slug = 'enru';

-- 22. 沒收到美股群的邀請連結
INSERT INTO knowledge (author_id, type, title, content, category, subcategory, word_count, status)
SELECT id, 'text',
'沒收到美股群的邀請連結',
'Q: 買了大補包沒收到信，沒收到美股群連結？
A: 連結會發到信箱或簡訊，請檢查垃圾郵件。若仍未收到請私訊客服官方帳號。',
'community', 'join_group', 40, 'ready'
FROM authors WHERE slug = 'enru';

-- 23. 手機 LINE 打不開美股群申請網址
INSERT INTO knowledge (author_id, type, title, content, category, subcategory, word_count, status)
SELECT id, 'text',
'手機 LINE 打不開美股群申請網址',
'Q: 手機 LINE 打不開美股群申請網址？
A: 這是手機瀏覽器相容性問題，建議改用電腦版 LINE 點擊連結申請。',
'community', 'join_group', 35, 'ready'
FROM authors WHERE slug = 'enru';

-- 24. 姓名電話格式被駁回
INSERT INTO knowledge (author_id, type, title, content, category, subcategory, word_count, status)
SELECT id, 'text',
'姓名電話格式被駁回',
'Q: 填了電話被退回，說格式不對
A: 請你幫忙再申請一次美股群，姓名電話中間幫我加一個橫線看看，例如：林恩如-0912345678。如果手機不能點，可以試試看電腦版的 LINE 喔。',
'community', 'verification', 55, 'ready'
FROM authors WHERE slug = 'enru';

-- 25. 美股群三個月後解散以後去哪問
INSERT INTO knowledge (author_id, type, title, content, category, subcategory, word_count, status)
SELECT id, 'text',
'美股群三個月後解散以後去哪問',
'Q: 美股群三個月後解散，以後有問題去哪問？
A: 請回到「台股菁英大群」，大群是永久存在的，助教都在裡面。',
'community', 'general', 40, 'ready'
FROM authors WHERE slug = 'enru';

-- 26. 為什麼社群內有人一直在喊 168
INSERT INTO knowledge (author_id, type, title, content, category, subcategory, word_count, status)
SELECT id, 'text',
'為什麼社群內有人一直在喊 168',
'Q: 為什麼社群內有人一直在喊 168？
A: 這是學員間的默契，祝大家投資一路發，是激勵士氣的文化。',
'community', 'general', 35, 'ready'
FROM authors WHERE slug = 'enru';

-- =============================================
-- 四、證券開戶 (brokerage)
-- =============================================

-- 27. 開口袋證券一定要去銀行臨櫃嗎
INSERT INTO knowledge (author_id, type, title, content, category, subcategory, word_count, status)
SELECT id, 'text',
'開口袋證券一定要去銀行臨櫃嗎',
'Q: 開口袋證券一定要去銀行臨櫃嗎？
A: 不需要，全程線上開戶即可。交割會先透過「口袋錢包」虛擬帳戶處理。',
'brokerage', 'account', 40, 'ready'
FROM authors WHERE slug = 'enru';

-- 28. 口袋證券可以改綁別家銀行帳戶嗎
INSERT INTO knowledge (author_id, type, title, content, category, subcategory, word_count, status)
SELECT id, 'text',
'口袋證券可以改綁別家銀行帳戶嗎',
'Q: 口袋證券可以改綁別家銀行帳戶嗎？
A: 開戶後可以新增其他銀行帳戶，並在 App 設定內更改主帳號。',
'brokerage', 'account', 35, 'ready'
FROM authors WHERE slug = 'enru';

-- 29. 期貨軟體什麼時候會優惠
INSERT INTO knowledge (author_id, type, title, content, category, subcategory, word_count, status)
SELECT id, 'text',
'期貨軟體什麼時候會優惠',
'Q: 期貨軟體什麼時候會優惠？
A: 關注社群公告，通常在特定直播活動或年節會有促銷。',
'brokerage', 'operation', 30, 'ready'
FROM authors WHERE slug = 'enru';

-- =============================================
-- 五、防詐騙 (security)
-- =============================================

-- 30. 收到林恩如私訊邀請進投資群
INSERT INTO knowledge (author_id, type, title, content, category, subcategory, word_count, status)
SELECT id, 'text',
'收到林恩如私訊邀請進投資群',
'Q: 有人私訊我推薦股票...收到「林恩如」私訊邀請進投資群？
A: 這是詐騙！！老師和助教都不會主動私訊喔！請認明藍勾勾，還有我們管理員頭像右下角都有個小皇冠喔。',
'security', 'fraud_alert', 55, 'ready'
FROM authors WHERE slug = 'enru';

-- 31. 有人私訊我是不是老師助理
INSERT INTO knowledge (author_id, type, title, content, category, subcategory, word_count, status)
SELECT id, 'text',
'有人私訊我是不是老師助理',
'Q: 有人私訊我是不是老師助理？
A: 絕對是詐騙！老師與小編絕對不會主動私訊。',
'security', 'fraud_alert', 30, 'ready'
FROM authors WHERE slug = 'enru';

-- 32. 不小心點了不明連結會被盜嗎
INSERT INTO knowledge (author_id, type, title, content, category, subcategory, word_count, status)
SELECT id, 'text',
'不小心點了不明連結會被盜嗎',
'Q: 不小心點了不明連結會被盜嗎？
A: 立即關閉分頁，不要輸入任何個資，並向 LINE 官方檢舉該帳號。',
'security', 'fraud_alert', 35, 'ready'
FROM authors WHERE slug = 'enru';

-- 33. 如何辨識社群內的真假助教
INSERT INTO knowledge (author_id, type, title, content, category, subcategory, word_count, status)
SELECT id, 'text',
'如何辨識社群內的真假助教',
'Q: 如何辨識社群內的真假助教？
A: 認明大頭照右下角的「管理員皇冠」標誌，沒皇冠的都是假冒。',
'security', 'identity', 35, 'ready'
FROM authors WHERE slug = 'enru';

-- 34. 假粉專看起來很像怎麼區分
INSERT INTO knowledge (author_id, type, title, content, category, subcategory, word_count, status)
SELECT id, 'text',
'假粉專看起來很像怎麼區分',
'Q: 假粉專看起來很像，怎麼區分？
A: 認明藍勾勾，且粉絲人數應為 12 萬以上。',
'security', 'identity', 30, 'ready'
FROM authors WHERE slug = 'enru';

-- 35. 有人在社群私訊問我持股怎麼辦
INSERT INTO knowledge (author_id, type, title, content, category, subcategory, word_count, status)
SELECT id, 'text',
'有人在社群私訊問我持股怎麼辦',
'Q: 有人在社群私訊問我持股怎麼辦？
A: 不要理會，截圖並回報給社群管理員（大貓或 Niko）處理。',
'security', 'identity', 35, 'ready'
FROM authors WHERE slug = 'enru';

-- =============================================
-- 六、其他 (general)
-- =============================================

-- 36. 軟體續約可以換信用卡刷嗎
INSERT INTO knowledge (author_id, type, title, content, category, subcategory, word_count, status)
SELECT id, 'text',
'軟體續約可以換信用卡刷嗎',
'Q: 軟體續約可以換信用卡刷嗎？
A: 可以，請至理財寶會員中心的「訂閱管理」更改支付卡片。',
'general', 'subscription', 30, 'ready'
FROM authors WHERE slug = 'enru';

-- =============================================
-- 完成
-- =============================================
-- 共插入 36 筆 Q&A 資料
