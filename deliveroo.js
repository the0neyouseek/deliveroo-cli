#!/usr/bin/env node

const Configstore = require('configstore');
const Deliveroo = require('node-deliveroo');
const {prompt} = require('enquirer');
const ora = require('ora');
const moment = require('moment');
const pkg = require('./package.json');

const conf = new Configstore(pkg.name);
const deliveroo = new Deliveroo();

let user;
let currentAddress;
let currentRestaurant;
let currentOrder = [];
let currentModifiers = [];

console.log(`Deliveroo Cli ${pkg.version}`);
console.log('');

if (conf.has('login') && conf.has('password')) {
	reconnect();
} else {
	console.log('Please login to Deliveroo to start');
	startConnectionProcess();
}

function startConnectionProcess() {
	prompt([
		{
			type: 'input',
			name: 'login',
			message: 'Username'
		},
		{
			type: 'password',
			name: 'password',
			message: 'Password'
		}
	]).then(response => {
		if (response.login && response.password) {
			const spinner = ora('Connecting to Deliveroo…').start();
			deliveroo.login(response.login, response.password).then(result => {
				if (result) {
					spinner.succeed('Connection successful');
					user = result;
					conf.set('login', response.login);
					conf.set('password', response.password);
					userConnected();
				} else {
					spinner.fail('Error connecting to Deliveroo. Wrong login or password');
					console.log('Try again… (CTRL+C to cancel)');
					startConnectionProcess();
				}
			});
		}
	});
}

function reconnect() {
	const spinner = ora('Connecting to Deliveroo…').start();
	deliveroo.login(conf.get('login'), conf.get('password')).then(result => {
		if (result) {
			user = result;
			spinner.succeed('Connection successful');
			userConnected();
		} else {
			spinner.fail('Error reconnecting to Deliveroo');
			conf.delete('login');
			conf.delete('password');
			console.log('Please login to Deliveroo to start');
			startConnectionProcess();
		}
	});
}

function userConnected() {
	console.log(`Welcome ${user.first_name} !`);
	startProcess();
}

function startProcess() {
	console.log('');
	prompt({
		type: 'select',
		name: 'choice',
		message: 'What would you like to do next ?',
		initial: 0,
		choices: [
			{
				name: 'status',
				message: 'Check the status of my order'
			},
			{
				name: 'new',
				message: 'Place a new order'
			},
			{
				name: 'stop',
				message: 'Exit'
			}
		]
	}).then(response => {
		if (response.choice === 'status') {
			getOrderStatus();
		} else if (response.choice === 'new') {
			startNewOrder();
		} else {
			console.log('Goodbye !');
		}
	});
}

function getOrderStatus() {
	const spinner = ora('Looking up for pending orders…').start();
	deliveroo.getHistory(user.id).then(result => {
		if (result.orders !== undefined && result.orders !== null && result.orders.length > 0) {
			const latestOrder = result.orders[0];
			if (latestOrder !== undefined && latestOrder !== null) {
				const submittedDate = moment(latestOrder.submitted_at);
				const now = moment();
				if (submittedDate.isSame(now, 'day')) {
					spinner.succeed(latestOrder.consumer_status.title);
					console.log(latestOrder.consumer_status.message);
					startProcess();
				} else {
					spinner.fail('We couldn\'t find any pending order');
					startProcess();
				}
			} else {
				spinner.fail('We couldn\'t find any pending order');
				startProcess();
			}
		} else {
			spinner.fail('We couldn\'t find any pending order');
			startProcess();
		}
	});
}

function startNewOrder() {
	currentAddress = null;
	currentRestaurant = null;
	currentOrder = [];
	currentModifiers = [];
	getAddressList();
}

function getAddressList() {
	const spinner = ora('Looking up your saved addresses').start();
	deliveroo.getSavedAddresses(user.id).then(result => {
		if (result.addresses && result.addresses.length > 0) {
			spinner.stop();
			const choices = [];
			result.addresses.forEach(address => {
				choices.push({
					name: `${address.label}`,
					message: `${address.label} : ${address.address1}, ${address.post_code} ${address.city}`
				});
			});
			choices.push({
				name: 'new-address',
				message: '+ Add a new address'
			},
			{
				name: 'back',
				message: '↩︎ ︎︎︎︎Go back'
			});
			prompt({
				type: 'select',
				name: 'address',
				message: 'Choose an address to deliver to :',
				choices
			}).then(res => {
				if (res && res.address) {
					if (res.address === 'back') {
						startProcess();
					} else if (res.address === 'new-address') {
						addNewAddress();
					} else {
						const address = result.addresses.find(address => {
							return address.label === res.address;
						});
						if (address) {
							getAvailableRestaurantsForAddress(address);
						} else {
							console.error('Invalid address selected, please try again.');
							getAddressList();
						}
					}
				}
			});
		} else {
			spinner.fail('No addresses saved in your account.');
			addNewAddress();
		}
	});
}

function addNewAddress() {
	prompt({
		type: 'form',
		name: 'address',
		message: 'Enter your new address',
		choices: [
			{
				name: 'name',
				message: 'Name'
			},
			{
				name: 'address',
				message: 'Address'
			},
			{
				name: 'postCode',
				message: 'Post code'
			},
			{
				name: 'city',
				message: 'City'
			},
			{
				name: 'country',
				message: 'Country'
			},
			{
				name: 'phone',
				message: 'Phone number'
			}
		]
	}).then(result => {
		if (result) {
			deliveroo.addSavedAddress(user.id, {
				name: result.name,
				phone: result.phone,
				address: result.address,
				postCode: result.postCode,
				country: result.country,
				lat: 0,
				lng: 0
			}).then(address => {
				console.log(address);
			});
		} else {
			console.error('Wrong address, please try again');
			addNewAddress();
		}
	});
}

function getAvailableRestaurantsForAddress(address) {
	currentAddress = address;
	const spinner = ora('Looking up available restaurants…').start();
	deliveroo.getAvailableRestaurants(address.coordinates[1], address.coordinates[0]).then(restaurants => {
		if (restaurants && restaurants.length > 0) {
			restaurants = restaurants.filter(r => r.open);
			spinner.succeed(`${restaurants.length} restaurants found.`);
			prompt({
				type: 'select',
				name: 'search',
				message: 'How would you like to choose the restaurant ?',
				choices: [
					{
						name: 'name',
						message: 'Search by restaurant name'
					},
					{
						name: 'category',
						message: 'Search by food category'
					},
					{
						name: 'time',
						message: 'Display the top 10 by delivery time'
					},
					{
						name: 'back',
						message: '↩︎ Choose another address'
					}
				]
			}).then(result => {
				if (result && result.search) {
					if (result.search === 'name') {
						console.log('By name');
						chooseRestaurantByName(restaurants);
					} else if (result.search === 'category') {
						console.log('By cat');
						chooseRestaurantByCategories(restaurants);
					} else if (result.search === 'time') {
						const sorted = getTopTenByDeliveryTime(restaurants);
						chooseRestaurant(sorted);
					} else if (result.search === 'back') {
						getAddressList();
					}
				}
			});
		} else {
			spinner.fail('No available restaurants for the selected address. Please choose another address.');
			getAddressList();
		}
	});
}

function getTopTenByDeliveryTime(restaurants) {
	return restaurants.sort((previousR, nextR) => previousR.total_time - nextR.total_time).slice(0, 10);
}

function chooseRestaurant(restaurants) {
	if (restaurants && restaurants.length > 0) {
		const choices = [];
		restaurants.forEach(restaurant => {
			let msg = `${restaurant.name} [${restaurant.category}] `;
			for (let i = 0; i < restaurant.price_category; i++) {
				msg += '€';
			}
			msg += ` (${restaurant.target_delivery_time.minutes} min)`;
			choices.push({
				name: restaurant.uname,
				message: msg
			});
		});
		choices.push({
			name: 'back',
			message: '↩︎ ︎︎︎︎Go back'
		});
		prompt({
			type: 'select',
			name: 'restaurant',
			message: 'Choose a restaurant :',
			choices
		}).then(result => {
			if (result && result.restaurant) {
				if (result.restaurant === 'back') {
					getAvailableRestaurantsForAddress(currentAddress);
				} else {
					const restaurant = restaurants.find(restaurant => restaurant.uname === result.restaurant);
					displayRestaurantMenu(restaurant);
				}
			}
		});
	} else {
		console.error('No restaurant found. Please try another search method');
		getAvailableRestaurantsForAddress(currentAddress);
	}
}

function chooseRestaurantByName(restaurants) {
	if (restaurants && restaurants.length > 0) {
		const choices = [];
		restaurants.forEach(restaurant => {
			choices.push({
				name: restaurant.uname,
				message: restaurant.name
			});
		});
		choices.push();
		prompt({
			type: 'autocomplete',
			name: 'restaurant',
			message: 'Search by name',
			choices
		}).then(result => {
			if (result && result.restaurant) {
				const restaurant = restaurants.find(restaurant => restaurant.uname === result.restaurant);
				displayRestaurantMenu(restaurant);
			}
		});
	} else {
		console.error('No restaurant found. Please try another search method');
		getAvailableRestaurantsForAddress(currentAddress);
	}
}

function chooseRestaurantByCategories(restaurants) {
	if (restaurants && restaurants.length > 0) {
		const choices = [];
		const cats = restaurants.map(r => r.category);
		const ucats = [...new Set(cats)];
		ucats.forEach(category => {
			choices.push({
				name: category,
				message: category
			});
		});
		choices.push();
		prompt({
			type: 'autocomplete',
			name: 'category',
			message: 'Search by category',
			choices
		}).then(result => {
			if (result && result.category) {
				const filteredRestaurants = restaurants.filter(restaurant => restaurant.category === result.category);
				chooseRestaurant(filteredRestaurants);
			}
		});
	} else {
		console.error('No restaurant found. Please try another search method');
		getAvailableRestaurantsForAddress(currentAddress);
	}
}

function displayRestaurantMenu(restaurant) {
	const spinner = ora('Loading restaurant menu…').start();
	deliveroo.getRestaurantDetails(restaurant.id).then(result => {
		if (result) {
			currentRestaurant = result;
			spinner.stop();
			console.log('');
			console.log(result.name);
			console.log(`${result.delivery_fee.presentational} - ${result.minimum_order_value.presentational}`);
			console.log('');
			selectMenuCategorie();
		} else {
			spinner.fail('Restaurant not found. Please try another one');
			getAvailableRestaurantsForAddress(currentAddress);
		}
	});
}

function selectMenuCategorie() {
	const categories = currentRestaurant.menu.menu_categories.filter(c => c.top_level);
	const choices = [];
	categories.forEach(cat => {
		choices.push({
			name: cat.id,
			message: cat.name
		});
	});
	prompt({
		type: 'select',
		name: 'menu',
		message: 'Choose a category from the menu',
		choices
	}).then(result => {
		if (result && result.menu) {
			const foods = currentRestaurant.menu.menu_items.filter(m => m.available && m.category_id === result.menu);
			selectFood(foods);
		}
	});
}

function selectFood(foods) {
	const choices = [];
	foods.forEach(food => {
		let msg = `${food.name} (${food.price}${currentRestaurant.currency_symbol})`;
		if (food.description) {
			msg += ` ${food.description}`;
		}
		choices.push({
			name: food.id,
			message: msg
		});
	});
	choices.push({
		name: 'back',
		message: '↩︎ Choose from another category'
	});
	prompt({
		type: 'select',
		name: 'food',
		message: 'Choose an item from this category',
		choices
	}).then(result => {
		if (result && result.food) {
			if (result.food === 'back') {
				selectMenuCategorie();
			} else {
				const food = foods.find(f => f.id === result.food);
				const modifiers = currentRestaurant.menu.menu_modifier_groups.filter(mod => food.modifier_group_ids.includes(mod.id));
				if (modifiers.length === 0) {
					// Confirm add to cart
					addFoodToCart(food);
				} else {
					// Modifiers
					chooseModifiers(food, modifiers);
				}
			}
		}
	});
}

function addFoodToCart(food, modifiers = []) {
	console.log(`${food.name} added to cart`);
	currentOrder.push({
		i: food.id,
		q: 1,
		m: modifiers
	});
	prompt({
		type: 'select',
		name: 'addMoreOrPlaceOrder',
		message: 'Would like to add more or place order now?',
		choices: [
			{
				name: 'more',
				message: '+ Add more food'
			},
			{
				name: 'order',
				message: '✓ Place order now'
			},
			{
				name: 'cancel',
				message: 'X Cancel order'
			}
		]
	}).then(res => {
		if (res && res.addMoreOrPlaceOrder) {
			if (res.addMoreOrPlaceOrder === 'more') {
				displayRestaurantMenu(currentRestaurant);
			} else if (res.addMoreOrPlaceOrder === 'order') {
				recapOrder();
			} else if (res.addMoreOrPlaceOrder === 'cancel') {
				startProcess();
			}
		}
	});
}

function chooseModifiers(food, modifiers, index = 0) {
	const currentMod = modifiers[index];
	const choices = [];
	currentMod.modifier_item_ids.forEach(modId => {
		const item = currentRestaurant.menu.menu_items.find(i => i.id === modId && i.available);
		let msg = item.name;
		if (item.description) {
			msg += ` (${item.description})`;
		}
		if (item.price && item.price !== '0.0') {
			msg += ` (+${item.price}${currentRestaurant.currency_symbol})`;
		}
		choices.push({
			name: `${modId}`,
			message: msg
		});
	});
	prompt({
		type: 'multiselect',
		name: 'mod',
		message: `${currentMod.name} (min ${currentMod.min_selection_points} - max ${currentMod.max_selection_points})`,
		choices
	}).then(res => {
		if (res &&
			res.mod &&
			res.mod.length >= currentMod.min_selection_points &&
			res.mod.length <= currentMod.max_selection_points) {
			currentModifiers.push({
				g: currentMod.id, i: res.mod.map(mod => parseInt(mod, 10))
			});
			if (index < (modifiers.length - 1)) {
				index++;
				chooseModifiers(food, modifiers, index);
			} else {
				addFoodToCart(food, currentModifiers);
				currentModifiers = [];
			}
		} else {
			console.log('Please select the correct amount');
			chooseModifiers(food, modifiers, index);
		}
	});
}

function choosePaymentMethod() {
	deliveroo.getPaymentMethods(user.id).then(res => {
		if (res && res.payment_tokens && res.payment_tokens.length > 0) {
			const choices = [];
			res.payment_tokens.forEach(paym => {
				choices.push({
					name: paym.id,
					message: `${paym.payment_type} - **** **** **** ${paym.discriminator}`
				});
			});
			choices.push({
				name: 'new',
				message: '+ Add a new payment method'
			});
			choices.push({
				name: 'cancel',
				message: 'X Cancel order'
			});
			prompt({
				type: 'select',
				name: 'payment',
				message: 'Choose a payment method',
				choices
			}).then(choice => {
				if (choice && choice.payment) {
					if (choice.payment === 'new') {
						addNewPaymentMethod();
					} else if (choice.payment === 'cancel') {
						startProcess();
					} else {
						placeOrder(choice.payment);
					}
				}
			});
		} else {
			addNewPaymentMethod();
		}
	});
}

// TODO: Write this
function addNewPaymentMethod() {
	console.log('TODO');
}

function recapOrder() {
	// TODO: Check if price is above minimum price for the restaurant
	console.log('');
	console.log('Here\'s a recap of your order :');
	console.log('');
	console.log(currentOrder);
	console.log('');

	choosePaymentMethod();
}
// TODO: Write this
function placeOrder(paymentMethod) {
	console.log(paymentMethod);
	console.log('Bon appétit ! Your order was placed');
}
