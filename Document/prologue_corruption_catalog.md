# prologue_hms_divine_dialogue.yaml — Corruption Catalog

Corruption pattern: Vietnamese multi-byte characters were partially corrupted.
The damage appears as `XềE` sequences where a valid Vietnamese syllable lost its final byte
and gained a literal capital `E`. Example: `thề` + `E` instead of `thể`.

**Em-dashes (—) are already fixed.** Only Vietnamese character corruption remains below.

Please validate the **Fix** column. Mark any wrong fixes. Leave blank = agent could not guess.

---

## YORK section

| Event ID | Origin (corrupted) | Fix (proposed) |
|---|---|---|
| york-approach / york-hub | `sềEcái trông như chứa nhiều mục hơn mức có thềE` | `sổ cái trông như chứa nhiều mục hơn mức có thể` |
| york-hub | `Ông đặt cuốn sềEsang một bên` | `Ông đặt cuốn sổ sang một bên` |
| york-hub | `bao giềEđềEthất lạc` | `bao giờ để thất lạc` |
| york-hub | `không nhềEcủa cả việc lái` | `không nhỏ của cả việc lái` |
| york-hub | `người đúng đềEhỏi` | `người đúng để hỏi` |
| york-hub | `cuốn sềEcái đang mềE` | `cuốn sổ cái đang mở` |
| york-hub | `Hai cuốn khác đang chềE` | `Hai cuốn khác đang chờ` |
| york-hub | `cụ thềElà gì` | `cụ thể là gì` |
| york-hub | `trang bềEnào dư không` | `trang bị nào dư không` |
| york-hub | `ĐềE${npc_2p} làm việc tiếp` | `Để ${npc_2p} làm việc tiếp` |
| york-hub (option) | `VềETrung úy Morale` | `Về Trung úy Morale` |
| york-continue (repeat) | `cụ thềElà gì` | `cụ thể là gì` |
| york-continue (repeat) | `trang bềEnào dư không` | `trang bị nào dư không` |
| york-continue (repeat) | `ĐềE${npc_2p} làm việc tiếp` | `Để ${npc_2p} làm việc tiếp` |
| york-continue (option, repeat) | `VềETrung úy Morale` | `Về Trung úy Morale` |
| york-how-things | `thú vềEhơn, hãy hỏi ${npc_1p} điều gì cụ thềE` | `thú vị hơn, hãy hỏi ${npc_1p} điều gì cụ thể` |
| york-work | `trang thiết bềE hềEsơ thủy thủ` | `trang thiết bị, hồ sơ thủy thủ` |
| york-numbers | `sềElượng hiện tại` | `số lượng hiện tại` |
| york-numbers | `${npc_1p} thích con sềEđó nhềEhơn` | `${npc_1p} thích con số đó nhiều hơn` |
| york-numbers | `cuốn sềEnhư thềEnó có thềEđã tự cập nhật` | `cuốn sổ như thể nó có thể đã tự cập nhật` |
| york-numbers | `đềEdành thời gian đó` | `để dành thời gian đó` |
| york-landing | `tự lập chềEđứng` | `tự lập chỗ đứng` |
| york-landing | `vềEthành công` | `về thành công` |
| york-landing | `vềEnhững quyết định tập thềE` | `về những quyết định tập thể` |
| york-landing | `định cư ềEđâu` | `định cư ở đâu` |
| york-landing | `tềEchức ra sao` | `tổ chức ra sao` |
| york-landing | `hềEquả mà ${npc_1p} có thềEdự đoán nhưng không thềEquyết định` | `hậu quả mà ${npc_1p} có thể dự đoán nhưng không thể quyết định` |
| york-food | `tềEchức quá trình đó` | `tổ chức quá trình đó` |
| york-food | `vềEnó trước khi` | `về nó trước khi` |

---

## VORNE section

| Event ID | Origin (corrupted) | Fix (proposed) |
|---|---|---|
| vorne-hub | `hải đềEcho đến khi` | `hải đồ cho đến khi` |
| vorne-hub | `tấm hải đềE rồi dường như` | `tấm hải đồ, rồi dường như` |
| vorne-hub | `không chạm vào hải đềEcủa` | `không chạm vào hải đồ của` |
| vorne-hub (option) | `${npc_2p} đã chềEhuy con tàu này` | `${npc_2p} đã chỉ huy con tàu này` |
| vorne-hub | `ĐềE${npc_2p} làm việc` | `Để ${npc_2p} làm việc` |
| vorne-continue (repeat) | `${npc_2p} đã chềEhuy con tàu này` | `${npc_2p} đã chỉ huy con tàu này` |
| vorne-continue (repeat) | `ĐềE${npc_2p} làm việc` | `Để ${npc_2p} làm việc` |
| vorne-how-long | `đủ già đềEđã chứng minh` | `đủ già để đã chứng minh` |
| vorne-how-long | `chưa đủ già đềEtrềEthành rủi ro` | `chưa đủ già để trở thành rủi ro` |
| vorne-how-long | `chềEhuy tàu tềEhơn` | `chỉ huy tàu tệ hơn` |
| vorne-how-long | `tàu tốt hơn trong hoàn cảnh tềEhơn` | `tàu tốt hơn trong hoàn cảnh tệ hơn` |
| vorne-chaotic-sea | `ềEphía xa` | `ở phía xa` |
| vorne-chaotic-sea | `Từ đó trềEđi` | `Từ đó trở đi` |
| vorne-chaotic-sea | `trềEnên vô lý` | `trở nên vô lý` |
| vorne-chaotic-sea | `không thềEđoán trước` | `không thể đoán trước` |
| vorne-chaotic-sea | `ChềEcó La Bàn Konrad` | `Chỉ có La Bàn Konrad` |
| vorne-chaotic-sea | `Nó không chềEđường` | `Nó không chỉ đường` |
| vorne-chaotic-sea | `nó chềEcho ${2p} biết` | `nó chỉ cho ${2p} biết` |
| vorne-chaotic-sea | `đềEtàu đi đúng hướng` | `để tàu đi đúng hướng` |
| vorne-chaotic-sea | `${2p} không biết mình đang ềEđâu` | `${2p} không biết mình đang ở đâu` |
| vorne-chaotic-sea | `đi vềEphía nào` | `đi về phía nào` |
| vorne-chaotic-sea | `tàu thường không trềEvềEtừ đó` | `tàu thường không trở về từ đó` |
| vorne-chaotic-sea | `hềEkhông thềEquay vềEđềEkềElại` | `họ không thể quay về để kể lại` |
| vorne-chaotic-sea | `biết hềEcó khả năng` | `biết họ có khả năng` |
| vorne-chaotic-sea | `đó là tất cả những gì của việc chềEhuy` | `đó là tất cả những gì của việc chỉ huy` |
| vorne-chaotic-sea | `biết điều gì có thềEyêu cầu` | `biết điều gì có thể yêu cầu` |

---

## McBETHA section

| Event ID | Origin (corrupted) | Fix (proposed) |
|---|---|---|
| mcbetha-hub | `BềEáo lềEcủa ông mỏng` | `Bộ áo lễ của ông mỏng` |
| mcbetha-hub | `${npc_1p} ềEđây đềEhữu ích` | `${npc_1p} ở đây để hữu ích` |
| mcbetha-hub | `${npc_name} đang ềEboong mũi` | `${npc_name} đang ở boong mũi` |
| mcbetha-hub | `vềEnhững gì chúng ta` | `về những gì chúng ta` |
| mcbetha-hub | `ĐềE${npc_2p} tiếp tục` | `Để ${npc_2p} tiếp tục` |
| mcbetha-continue (repeat) | `vềEnhững gì chúng ta` | `về những gì chúng ta` |
| mcbetha-continue (repeat) | `ĐềE${npc_2p} tiếp tục` | `Để ${npc_2p} tiếp tục` |
| mcbetha-worry (name) | `McBetha —VềELo Lắng` | `McBetha — Về Lo Lắng` |
| mcbetha-worry | `lo lắng vềEcách chúng ta` | `lo lắng về cách chúng ta` |
| mcbetha-worry | `Việc tìm ra thì dềE Còn` | `Việc tìm ra thì dễ. Còn` |
| mcbetha-worry | `điều khiến ${npc_1p} trăn trềE` | `điều khiến ${npc_1p} trăn trở` |
| mcbetha-worry | `Những người trên con tàu này thì có thềEcần` | `Những người trên con tàu này thì có thể cần` |
| mcbetha-sea | `Người ta ềEtrên biển lâu` | `Người ta ở trên biển lâu` |
| mcbetha-sea | `điều hềEbình thường không nghĩ đến` | `điều họ bình thường không nghĩ đến` |
| mcbetha-sea | `${npc_1p} ềEđây đềEnhững suy nghĩ đó có chềEđến` | `${npc_1p} ở đây để những suy nghĩ đó có chỗ đến` |
| mcbetha-plants | `vềEhềEsơ thực vật học` | `về hồ sơ thực vật học` |
| mcbetha-plants | `Cả hai đều giả vềEngười kia sai` | `Cả hai đều giả vờ người kia sai` |
| mcbetha-plants | `đủ lâu đềEhọc được điều gì đó` | `đủ lâu để học được điều gì đó` |

---

## HENSBANE section

| Event ID | Origin (corrupted) | Fix (proposed) |
|---|---|---|
| hensbane-hub | `đềEquen với nhịp sóng` | `để quen với nhịp sóng` |
| hensbane-hub | `đơn vềEcủa ${npc_1p}` | `đơn vị của ${npc_1p}` |
| hensbane-hub | `đềEđảm bảo an ninh` | `để đảm bảo an ninh` |
| hensbane-hub | `tự bảo vềEmình` | `tự bảo vệ mình` |
| hensbane-hub | `giúp hềEđủ bình tĩnh đềEkhông hoảng loạn` | `giúp họ đủ bình tĩnh để không hoảng loạn` |
| hensbane-about (option) | `KềEvềEbản thân đi` | `Kể về bản thân đi` |
| hensbane-about (repeat) | `KềEvềEbản thân đi` | `Kể về bản thân đi` |
| hensbane-combat | `vềEviệc chiến đấu` | `về việc chiến đấu` |
| hensbane-leave (option) | `ĐềE${npc_2p} yên` | `Để ${npc_2p} yên` |
| hensbane-leave (repeat option) | `ĐềE${npc_2p} yên` | `Để ${npc_2p} yên` |
| hensbane-about (name) | `Hensbane —VềEBản Thân` | `Hensbane — Về Bản Thân` |
| hensbane-about | `những hợp đồng hềEtống nhềEềEtuyến` | `những hợp đồng hộ tống nhỏ ở tuyến` |
| hensbane-about | `chềEhuy đơn vềEvà từ đó đến giềEvẫn giữ vềEtrí này` | `chỉ huy đơn vị và từ đó đến giờ vẫn giữ vị trí này` |
| hensbane-rank | `mức đềErắc rối` | `mức độ rắc rối` |
| hensbane-work | `đơn vềElính đánh thuê quy mô nhềE` | `đơn vị lính đánh thuê quy mô nhỏ` |
| hensbane-work | `ềEnhững khu vực` | `ở những khu vực` |
| hensbane-work | `hợp đồng bảo vềEđoàn hàng, hềEtống thương nhân` | `hợp đồng bảo vệ đoàn hàng, hộ tống thương nhân` |
| hensbane-work | `những mối đe dọa nhềEtrước khi chúng trềEthành vấn đềElớn` | `những mối đe dọa nhỏ trước khi chúng trở thành vấn đề lớn` |
| hensbane-command | `quyền chềEhuy được chuyển qua` | `quyền chỉ huy được chuyển qua` |
| hensbane-command | `từ đó đến giềEcách hoạt động` | `từ đó đến giờ cách hoạt động` |
| hensbane-command | `Chúng tôi chềElà những người được thuê đềElàm việc khó` | `Chúng tôi chỉ là những người được thuê để làm việc khó` |
| hensbane-problem | `phát sinh vấn đềEmà không ai dự đoán` | `phát sinh vấn đề mà không ai dự đoán` |
| hensbane-problem | `trong thời điểm tồi tềE` | `trong thời điểm tồi tệ` |
| hensbane-problem | `Có một đơn vềEquen xử lý rủi ro` | `Có một đơn vị quen xử lý rủi ro` |
| hensbane-problem | `chềElà một công việc khác` | `chỉ là một công việc khác` |
| hensbane-combat | `Phần lớn vấn đềEkhông nằm ềEkỹ thuật mà nằm ềEcách` | `Phần lớn vấn đề không nằm ở kỹ thuật mà nằm ở cách` |
| hensbane-combat | `người chềEbiết đánh mạnh` | `người chỉ biết đánh mạnh` |
| hensbane-combat | `Chiến đấu là kỹ năng đềEkiểm soát…không phải đềEchứng minh` | `Chiến đấu là kỹ năng để kiểm soát…không phải để chứng minh` |
| hensbane-combat | `không hiểu điểm đó thường không trụ được lâu trong nghềEnày` | `không hiểu điểm đó thường không trụ được lâu trong nghề này` |
| hensbane-combat | `cách thực tế nhất có thềE` | `cách thực tế nhất có thể` |
| hensbane-spar-intro | `Buổi đầu chềEđềExem ${2p} đang ềEmức nào` | `Buổi đầu chỉ để xem ${2p} đang ở mức nào` |
| hensbane-spar-intro | `không cần lo lắng vềEkết quả` | `không cần lo lắng về kết quả` |
| hensbane-spar-ready | `ChềEcần giữ bình tĩnh` | `Chỉ cần giữ bình tĩnh` |
| hensbane-spar-ready | `cách cơ thềEphản ứng khi bềEép` | `cách cơ thể phản ứng khi bị ép` |
| hensbane-spar-ready | `Chuẩn bềExong thì bắt đầu` | `Chuẩn bị xong thì bắt đầu` |
| hensbane-spar-result (win) | `khi bềEép, điều đó cho thấy` | `khi bị ép, điều đó cho thấy` |
| hensbane-spar-result (win) | `${2p} có thềExử lý` | `${2p} có thể xử lý` |
| hensbane-spar-result | `chềEtiến bềEkhi được lặp lại` | `chỉ tiến bộ khi được lặp lại` |
| hensbane-spar-result (lose) | `Không vấn đềEgì` | `Không vấn đề gì` |
| hensbane-spar-result (lose) | `bềEép thì rất khó` | `bị ép thì rất khó` |
| hensbane-spar-result (lose) | `lỗi phềEbiến` | `lỗi phổ biến` |
| hensbane-spar-result (lose) | `có thềEsửa được` | `có thể sửa được` |
| hensbane-spar-result (lose) | `cơ thềEsẽ tự điều chỉnh` | `cơ thể sẽ tự điều chỉnh` |
| hensbane-spar-followup | `tiến bềEnhanh hơn, chềEkhiến cơ thềEmệt` | `tiến bộ nhanh hơn, chỉ khiến cơ thể mệt` |
| hensbane-spar-followup | `${npc_1p} thường ềEquanh khu vực` | `${npc_1p} thường ở quanh khu vực` |

---

## GALEBY section

| Event ID | Origin (corrupted) | Fix (proposed) |
|---|---|---|
| galeby-first-meeting | `tay tựa lên lan can gềE nhìn ra` | `tay tựa lên lan can gỗ, nhìn ra` |
| galeby-first-meeting (option) | `Gió hôm nay lạnh thật, ${npc_2p} nhềE` | `Gió hôm nay lạnh thật, ${npc_2p} nhỉ` |
| galeby-first-silence | `ra xa bềEgió mạnh hơn` | `ra xa bờ gió mạnh hơn` |
| galeby-first-silence | `đứng lâu dềEcảm lạnh` | `đứng lâu dễ cảm lạnh` |
| galeby-first-leave (option) | `rồi xuống nghềE` | `rồi xuống nghỉ` |
| galeby-second-meeting | `trên một thùng gềEsồi` | `trên một thùng gỗ sồi` |
| galeby-second-memory | `đềEtrả lại trước khi nghềEngơi` | `để trả lại trước khi nghỉ ngơi` |
| galeby-second-memory | `một lần ềEbềEbiển lục địa mới` | `một lần ở bờ biển lục địa mới` |
| galeby-second-memory | `nhắc ${npc_1p} nhềEvềEcái giá` | `nhắc ${npc_1p} nhớ về cái giá` |
| galeby-second-memory | `có thềEđềEnó lại` | `có thể để nó lại` |
| galeby-third-meeting | `buông bềEnó` | `buông bỏ nó` |
| galeby-third-meeting | `gõ nhẹ chiếc tẩu rỗng xuống gềE` | `gõ nhẹ chiếc tẩu rỗng xuống gỗ` |
| galeby-fourth-leave (option) | `Thôi, đềE${npc_2p} yên` | `Thôi, để ${npc_2p} yên` |
| galeby-fourth-memory | `Ông ngẩng đầu, vẻ chợt nhềEra điều gì đó` | `Ông ngẩng đầu, vẻ chợt nhớ ra điều gì đó` |
| galeby-fourth-memory | `trôi dạt vào bềEmột bềEtộc nhềE` | `trôi dạt vào bờ một bộ tộc nhỏ` |
| galeby-fourth-memory | `hềEgiữ ${npc_1p} lại` | `họ giữ ${npc_1p} lại` |
| galeby-fourth-memory | `mỗi tối đám thợ săn kềElại chuyến đi` | `mỗi tối đám thợ săn kể lại chuyến đi` |
| galeby-fourth-memory | `${npc_1p} vẫn nhềEchềEđó` | `${npc_1p} vẫn nhớ chỗ đó` |
| galeby-fourth-memory | `vẻ mặt hiện rõ sự trăn trềE` | `vẻ mặt hiện rõ sự trăn trở` |
| galeby-share (name, truncated) | `"Galeby —Lần 3 / Lời NhềE` | `"Galeby —Lần 3 / Lời Nhắn"` |
| galeby-share | `có đi vềEphía lục địa mới` | `có đi về phía lục địa mới` |
| galeby-share | `đềEý giúp ${npc_1p} xem` | `để ý giúp ${npc_1p} xem` |
| galeby-end-spear | `"Cái này là của hềE` | `"Cái này là của họ.` |
| galeby-end-spear | `nếu có ngày gặp lại hềEthì trả giúp` | `nếu có ngày gặp lại họ thì trả giúp` |
| galeby-end-rapier | `giềEgiữ cũng không làm gì` | `giờ giữ cũng không làm gì` |
| galeby-end-no-gift | `NhềEgiúp chuyện đó là được.` | `Nhớ giúp chuyện đó là được.` |
| galeby-fifth-meeting | `Ánh mắt ông dán vềEphía chân trời` | `Ánh mắt ông dán về phía chân trời` |
| galeby-career | `đủ đềEbiết lúc nào nên nghềEngơi rồi` | `đủ để biết lúc nào nên nghỉ ngơi rồi` |
| galeby-all-done (name) | `"Galeby —Không Còn Gì ĐềENói"` | `"Galeby —Không Còn Gì Để Nói"` |

---

## Notes for validator

- `ềE` at start of word → almost always `ở` (at/in)
- `vềE` → `về` (about / return to)
- `đềE` → `để` (to / in order to)
- `thềE` → `thể` (can)
- `chềE` → `chỉ` (only) OR `chờ` (wait) — check context
- `hềE` → `họ` (they) OR `hồ` (lake/file, as in hồ sơ)
- `tềE` → `tổ` (organize) OR `tệ` (bad/poor) — check context
- `nhềE` → `nhỏ` (small) OR `nhớ` (remember) OR `nhỉ` (right?) — check context
- `bềE` → `bị` (passive marker) OR `bờ` (shore) OR `bộ` (set/group) OR `bỏ` (abandon)
- `sềE` → `sổ` (ledger/notebook) OR `số` (number) — check context
- `gềE` → `gỗ` (wood) OR `gờ` (ledge/rim) — check context
- `mềE` → `mở` (open)
- `lềE` → `lễ` (ceremony/ritual)
- `kềE` → `kể` (tell/recount)
- `trềE` → `trở` (become/return to state)
- `dềE` → `dễ` (easy)
- `giềE` → `giờ` (now/hour)
- `nghềE` → `nghỉ` (rest) OR `nghề` (profession) — check context
