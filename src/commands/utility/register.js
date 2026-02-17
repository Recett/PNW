const {
	SlashCommandBuilder,
	InteractionContextType,
	MessageFlags,
	ModalBuilder,
	TextInputBuilder,
	TextInputStyle,
	ActionRowBuilder,
	EmbedBuilder,
	ButtonBuilder,
	ButtonStyle,
	ComponentType,
	ChannelType,
	ThreadAutoArchiveDuration,
} = require('discord.js');
const { CharacterBase, CharacterItem, CharacterThread, ItemLib, LocationBase, EventBase } = require('@root/dbObject.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('register')
		.setDescription('Register a new character in the world.')
		.setContexts(InteractionContextType.Guild),

	async execute(interaction) {
		try {
			const userId = interaction.user.id;

			// Check if user already has a character
			const existing = await CharacterBase.findOne({ where: { id: userId } });
			if (existing) {
				return await interaction.reply({
					content: 'You already have a registered character. Use `/deletechar` first if you wish to start over.',
					flags: MessageFlags.Ephemeral,
				});
			}

			// Build the registration modal
			const modal = new ModalBuilder()
				.setCustomId('register_character_modal')
				.setTitle('Bản Đăng Ký:');

			// Name input (required)
			const nameInput = new TextInputBuilder()
				.setCustomId('character_name')
				.setLabel('Tôi, người ký tên dưới đây, khai báo tên là:')
				.setStyle(TextInputStyle.Short)
				.setPlaceholder('Nhập tên nhân vật của bạn')
				.setRequired(true)
				.setMinLength(2)
				.setMaxLength(32);

			// Gender input (optional, defaults to Male)
			const genderInput = new TextInputBuilder()
				.setCustomId('character_gender')
				.setLabel('Và tôi thuộc giới tính:')
				.setStyle(TextInputStyle.Short)
				.setPlaceholder('Nam hoặc Nữ (mặc định: Nam)')
				.setRequired(false)
				.setMaxLength(20);

			// Age input (optional)
			const ageInput = new TextInputBuilder()
				.setCustomId('character_age')
				.setLabel('Và tôi đã sống được:')
				.setStyle(TextInputStyle.Short)
				.setPlaceholder('ví dụ: 25 (tùy chọn)')
				.setRequired(false)
				.setMaxLength(3);

			// Avatar input (optional)
			const avatarInput = new TextInputBuilder()
				.setCustomId('character_avatar')
				.setLabel('Hình ảnh của tôi có thể tìm thấy tại:')
				.setStyle(TextInputStyle.Short)
				.setPlaceholder('URL hình ảnh (tùy chọn)')
				.setRequired(false)
				.setMaxLength(500);

			// Add inputs to modal
			modal.addComponents(
				new ActionRowBuilder().addComponents(nameInput),
				new ActionRowBuilder().addComponents(genderInput),
				new ActionRowBuilder().addComponents(ageInput),
				new ActionRowBuilder().addComponents(avatarInput),
			);

			await interaction.showModal(modal);
		}
		catch (error) {
			console.error('Error in register command:', error);
			try {
				if (interaction.replied || interaction.deferred) {
					await interaction.followUp({ content: 'An error occurred.', flags: MessageFlags.Ephemeral });
				}
				else {
					await interaction.reply({ content: 'An error occurred.', flags: MessageFlags.Ephemeral });
				}
			}
			catch (replyError) {
				console.error('Error sending error message:', replyError);
			}
		}
	},

	/**
	 * Handle the modal submission - show certificate preview with Submit/Scrap buttons
	 */
	async handleModal(interaction) {
		try {
			const userId = interaction.user.id;

			// Double-check no existing character
			const existing = await CharacterBase.findOne({ where: { id: userId } });
			if (existing) {
				return await interaction.reply({ content: 'You already have a registered character.', flags: MessageFlags.Ephemeral });
			}

			// Extract values from modal
			const fullname = interaction.fields.getTextInputValue('character_name').trim();
			const name = fullname.split(/\s+/)[0];
			const gender = interaction.fields.getTextInputValue('character_gender')?.trim() || '';
			const ageStr = interaction.fields.getTextInputValue('character_age')?.trim();
			const avatar = interaction.fields.getTextInputValue('character_avatar')?.trim();

			// Validate age if provided
			let age = null;
			if (ageStr) {
				age = parseInt(ageStr);
				if (isNaN(age) || age < 1 || age > 999) {
					return await interaction.reply({ content: 'Please enter a valid age (1-999).', flags: MessageFlags.Ephemeral });
				}
			}

			// Get avatar URL - use provided avatar or fall back to server/user avatar
			const avatarUrl = avatar || interaction.member?.displayAvatarURL() || interaction.user.displayAvatarURL();

			// Normalize gender input (accept both Vietnamese and English, default to Male if empty)
			const genderLower = gender?.toLowerCase() || '';
			const isFemale = genderLower === 'female' || genderLower === 'nữ' || genderLower === 'nu';
			// Store normalized gender (defaults to Male if empty)
			const normalizedGender = isFemale ? 'Female' : 'Male';

			// Build certificate preview embed
			const certificateText =
				'Tôi, **' + name + '**, trân trọng kiến nghị được xuất dương sang Tân Thế Giới dưới danh nghĩa Sứ mệnh do Ngai vàng bảo trợ này.\n\n' +
				'**CÁC ĐIỀU KHOẢN THỎA THUẬN**\n\n' +
				'I. VỀ VIỆC VẬN CHUYỂN: Người Kiến nghị sẽ được bố trí một vị trí trên Tàu do Ngai vàng chỉ định, cùng với các nhu yếu phẩm và vật dụng cần thiết cho suốt hành trình. \n\n' +
				'II. VỀ TƯ CÁCH PHÁP LÝ: Người Kiến nghị tuyên bố bản thân là người tự do, hiện không bị ràng buộc bởi bất kỳ nghĩa vụ, khoản nợ, hoặc bản án nào của pháp luật có thể ngăn cản việc xuất cảnh hợp pháp khỏi Vương quốc Gateland.\n\n' +
				'III. VỀ SỰ TUÂN THỦ: Khi đặt chân đến Tân Thế Giới, Người Kiến nghị cam kết sẽ tiếp tục là một thần dân trung thành tuân theo Pháp luật của Đức Vua, đồng thời tuân thủ các Sắc lệnh của Thống đốc tại đó, như thể vẫn cư trú tại các tỉnh thành chính quốc.\n\n' +
				'IV. VỀ SỰ PHÓ THÁC: Người Kiến nghị chấp nhận rằng những hiểm nguy trên biển cả và chốn hoang dã nằm ngoài sự bảo đảm của Ngai vàng, và người này phó thác sự an toàn của bản thân cho sự cần cù của chính mình và ân điển của các Thánh.';


			const embed = new EmbedBuilder()
				.setTitle('CHỨNG THƯ DỰ ĐỊNH')
				.setDescription(certificateText)
				.setColor(0xf1c40f)
				.setFooter({ text: 'Đọc kĩ trước khi xác nhận. ' })
				.setThumbnail(avatarUrl);

			// Create Submit and Scrap buttons
			const row = new ActionRowBuilder().addComponents(
				new ButtonBuilder()
					.setCustomId('register_confirm')
					.setLabel('Submit')
					.setStyle(ButtonStyle.Success),
				new ButtonBuilder()
					.setCustomId('register_cancel')
					.setLabel('Scrap')
					.setStyle(ButtonStyle.Danger),
			);

			const reply = await interaction.reply({
				embeds: [embed],
				components: [row],
				flags: MessageFlags.Ephemeral,
			});

			// Set up button collector
			const collector = reply.createMessageComponentCollector({
				componentType: ComponentType.Button,
				time: 300_000,
				filter: i => i.user.id === userId,
			});

			collector.on('collect', async i => {
				if (i.customId === 'register_cancel') {
					collector.stop();
					await i.update({
						content: 'Registration cancelled.',
						embeds: [],
						components: [],
					});
					return;
				}

				if (i.customId === 'register_confirm') {
					collector.stop();
					await i.deferUpdate();

					try {
						// Create the character
						await CharacterBase.create({
							id: userId,
							name: name,
							fullname: fullname,
							gender: normalizedGender,
							age: age,
							avatar: avatarUrl,
							str: 9,
							dex: 9,
							agi: 9,
							con: 9,
							gold: 0,
							level: 1,
							xp: 0,
						});

						// Set unregistered flag - blocks certain commands until registration is complete
						const characterUtil = require('../../utility/characterUtility');
						await characterUtil.updateCharacterFlag(userId, 'unregistered', 1);

						// Move character to starter location (with "starter" or "start" tag)
						const locationUtil = interaction.client.locationUtil;
						const allLocations = await LocationBase.findAll();
						const starterLocation = allLocations.find(loc =>
							loc.tag && Array.isArray(loc.tag) &&
							(loc.tag.includes('starter') || loc.tag.includes('start')),
						);
						if (starterLocation && locationUtil) {
							await locationUtil.updateLocationRoles({
								guild: interaction.guild,
								memberId: userId,
								newLocationId: starterLocation.id,
							});
						}

						// Give starter items (items with exact tag "starter", not "starter_weapon" variants)
						const allItems = await ItemLib.findAll();
						const starterItems = allItems.filter(item =>
							item.tag && Array.isArray(item.tag) && item.tag.includes('starter'),
						);

						for (const item of starterItems) {
							// Auto-equip armor only, weapons will be equipped by finish_register event
							await CharacterItem.create({
								character_id: userId,
								item_id: item.id,
								amount: 1,
								equipped: item.item_type === 'armor',
							});
						}

						// Calculate combat stats
						await characterUtil.calculateCombatStat(userId);
						await characterUtil.calculateAttackStat(userId);

						// Set HP and Stamina to max
						const updatedChar = await CharacterBase.findOne({ where: { id: userId } });
						const updateFields = {};
						if (updatedChar?.maxHp != null) {
							updateFields.currentHp = updatedChar.maxHp;
						}
						if (updatedChar?.maxStamina != null) {
							updateFields.currentStamina = updatedChar.maxStamina;
						}
						if (Object.keys(updateFields).length > 0) {
							await CharacterBase.update(updateFields, { where: { id: userId } });
						}

						// Update embed to show success
						const successEmbed = new EmbedBuilder()
							.setTitle('CERTIFICATE OF INTENT')
							.setDescription(certificateText)
							.setColor(0x2ecc71)
							.setFooter({ text: 'Tôi trịnh trọng thề rằng những thông tin được cung cấp ở trên là sự thật, và không có gì khác ngoài sự thật.' })
							.setThumbnail(avatarUrl);

						if (starterLocation) {
							successEmbed.addFields({ name: 'Starting Location', value: starterLocation.name, inline: true });
						}

						await i.editReply({ embeds: [successEmbed], components: [] });

						// === Create interview thread ===
						// Find location with "interview" tag
						const interviewLocation = allLocations.find(loc =>
							loc.tag && Array.isArray(loc.tag) && loc.tag.includes('interview'),
						);

						if (interviewLocation && interviewLocation.channel) {
							try {
								// Get the interview channel
								const interviewChannel = await interaction.guild.channels.fetch(interviewLocation.channel);

								if (interviewChannel && interviewChannel.isTextBased()) {
									// Create a private thread for the interview
									const thread = await interviewChannel.threads.create({
										name: `Interview - ${name}`,
										autoArchiveDuration: ThreadAutoArchiveDuration.OneDay,
										type: ChannelType.PrivateThread,
										reason: `Registration interview for ${name}`,
									});

									// Add the user to the thread
									await thread.members.add(userId);

									// Store thread ID in CharacterThread table
									await CharacterThread.create({
										character_id: userId,
										location_id: interviewLocation.id,
										thread_id: thread.id,
									});

									// Move character to interview location
									if (locationUtil) {
										await locationUtil.updateLocationRoles({
											guild: interaction.guild,
											memberId: userId,
											newLocationId: interviewLocation.id,
										});
									}

									// Find event with "begin_interview" tag
									const allEvents = await EventBase.findAll({ where: { is_active: true } });
									const interviewEvent = allEvents.find(evt =>
										evt.tags && Array.isArray(evt.tags) && evt.tags.includes('begin_interview'),
									);

									if (!interviewEvent) {
										console.warn('Warning: No active event with "begin_interview" tag found. Interview button will not start an event.');
									}

									// Send interview start message in thread
									const interviewEmbed = new EmbedBuilder()
										.setDescription(
											'Đằng sau một bàn giấy lớn là một người trạc tầm tuổi ba mươi với những nếp nhăn nơi khóe mắt hằn sâu dấu vết của nắng muối và những dặm dài trên biển. Mái tóc màu nâu hạt dẻ được chải chuốt gọn gàng, điểm xuyết những sợi bạc lấp lánh dưới ánh sáng. Anh ta khoác trên mình chiếc áo brigandine bằng nhung xanh thẫm, với những chiếc đinh tán bạc phản chiếu ánh nắng từ ngoài cửa sổ. Bộ giáp sạch sẽ, tươm tất, mang theo dáng vẻ tĩnh lặng của một sĩ quan trẻ.\n\n' +
											(interviewEvent
												? ''
												: 'An administrator will be with you shortly.'),
										)
										.setColor(0x3498db)
										.setThumbnail('https://static.wikia.nocookie.net/fireemblem/images/f/f2/Portrait_Glen_Heroes.png/revision/latest?cb=20240716044328');

									const components = [];
									if (interviewEvent) {
										const startButton = new ButtonBuilder()
											.setCustomId(`start_interview|${userId}|${interviewEvent.id}`)
											.setLabel('Nói chuyện với anh ta')
											.setStyle(ButtonStyle.Primary);
										components.push(new ActionRowBuilder().addComponents(startButton));
									}

									await thread.send({
										content: `<@${userId}>`,
										embeds: [interviewEmbed],
										components: components,
									});

								}
							}
							catch (threadError) {
								console.error('Error creating interview thread:', threadError);
								// Non-fatal - registration still succeeds
							}
						}
					}
					catch (createError) {
						console.error('Error creating character:', createError);
						await i.editReply({ content: 'An error occurred while creating your character.', embeds: [], components: [] });
					}
				}
			});

			collector.on('end', async (collected, reason) => {
				if (reason === 'time' && collected.size === 0) {
					try {
						await interaction.editReply({
							content: 'Registration timed out. Please try again with `/register`.',
							embeds: [],
							components: [],
						});
					}
					catch (e) {
						// Ignore if message was deleted
					}
				}
			});
		}
		catch (error) {
			console.error('Error handling register modal:', error);
			try {
				if (interaction.replied || interaction.deferred) {
					await interaction.followUp({ content: 'An error occurred during registration.', flags: MessageFlags.Ephemeral });
				}
				else {
					await interaction.reply({ content: 'An error occurred during registration.', flags: MessageFlags.Ephemeral });
				}
			}
			catch (replyError) {
				console.error('Error sending error message:', replyError);
			}
		}
	},
};
