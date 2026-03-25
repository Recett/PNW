// @charset utf-8
// All Vietnamese strings for the /register command are kept here to prevent
// encoding corruption in the main logic file.
'use strict';

module.exports = {
	// Modal
	modal: {
		title: 'Bản Đăng Ký:',
		nameLabel: 'Tôi, người ký tên dưới đây, khai báo tên là:',
		namePlaceholder: 'Nhập tên nhân vật của bạn',
		genderLabel: 'Và tôi thuộc giới tính:',
		genderPlaceholder: 'Nam hoặc Nữ (mặc định: Nam)',
		ageLabel: 'Và tôi đã sống được:',
		agePlaceholder: 'ví dụ: 25 (tùy chọn)',
		avatarLabel: 'Hình ảnh của tôi có thể tìm thấy tại:',
		avatarPlaceholder: 'URL hình ảnh (tùy chọn)',
	},

	// Certificate preview embed
	certificate: {
		embedTitle: 'CHỨNG THƯ DỰ ĐỊNH',
		embedFooter: 'Đọc kĩ trước khi xác nhận. ',
		successEmbedTitle: 'CERTIFICATE OF INTENT',
		successEmbedFooter: 'Tôi trịnh trọng thề rằng những thông tin được cung cấp ở trên là sự thật, và không có gì khác ngoài sự thật.',
		getText: (name) =>
			`Tôi, **${name}**, trân trọng kiến nghị được xuất dương sang Tân Thế Giới dưới danh nghĩa Sứ mệnh do Ngai vàng bảo trợ này.\n\n` +
			'**CÁC ĐIỀU KHOẢN THỎA THUẬN**\n\n' +
			'I. VỀ VIỆC VẬN CHUYỂN: Người Kiến nghị sẽ được bố trí một vị trí trên Tàu do Ngai vàng chỉ định, cùng với các nhu yếu phẩm và vật dụng cần thiết cho suốt hành trình. \n\n' +
			'II. VỀ TƯ CÁCH PHÁP LÝ: Người Kiến nghị tuyên bố bản thân là người tự do, hiện không bị ràng buộc bởi bất kỳ nghĩa vụ, khoản nợ, hoặc bản án nào của pháp luật có thể ngăn cản việc xuất cảnh hợp pháp khỏi Vương quốc Gateland.\n\n' +
			'III. VỀ SỰ TUÂN THỦ: Khi đặt chân đến Tân Thế Giới, Người Kiến nghị cam kết sẽ tiếp tục là một thần dân trung thành tuân theo Pháp luật của Đức Vua, đồng thời tuân thủ các Sắc lệnh của Thống đốc tại đó, như thể vẫn cư trú tại các tỉnh thành chính quốc.\n\n' +
			'IV. VỀ SỰ PHÓ THÁC: Người Kiến nghị chấp nhận rằng những hiểm nguy trên biển cả và chốn hoang dã nằm ngoài sự bảo đảm của Ngai vàng, và người này phó thác sự an toàn của bản thân cho sự cần cù của chính mình và ân điển của các Thánh.',
	},

	// Interview thread
	interview: {
		description:
			'Đằng sau một bàn giấy lớn là một người trạc tầm tuổi ba mươi với những nếp nhăn nơi khóe mắt hằn sâu dấu vết của nắng muối và những dặm dài trên biển. Mái tóc màu nâu hạt dẻ được chải chuốt gọn gàng, điểm xuyết những sợi bạc lấp lánh dưới ánh sáng. Anh ta khoác trên mình chiếc áo brigandine bằng nhung xanh thẫm, với những chiếc đinh tán bạc phản chiếu ánh nắng từ ngoài cửa sổ. Bộ giáp sạch sẽ, tươm tất, mang theo dáng vẻ tĩnh lặng của một sĩ quan trẻ.\n\n',
		startButtonLabel: 'Nói chuyện với anh ta',
	},
};
