const Telegraf = require("telegraf").Telegraf;
const env = require("dotenv");
const { exec } = require("child_process");

env.config();

let bot = new Telegraf(process.env.BOT_TOKEN);
const users = process.env.BOT_USERS.split(", ") || [];
const TOP_COUNT = process.env.TOP_COUNT || 5;
startBot(bot);

let prcnt_per_n_steps_arr = [];
let prcnt_per_day_arr = [];

async function sendText(text) {
    try {
        users.forEach((user) => {
            bot.telegram.sendMessage(user, text, {
                parse_mode: "MarkdownV2",
                disable_web_page_preview: true,
            });
        });
        console.log("Сообщения отправленны!");
        return true;
    } catch (err) {
        console.log(err);
    }
}

async function notifyAboutParse({
    products_data,
    new_products,
    changed_products,
    my_products,
}) {
    const new_msg = getMessageAboutNewProducts(new_products);
    const change_msg = getMessageAboutChangedProducts(changed_products);
    const parse_msg = getMessageAboutParsedProducts(products_data);
    const my_products_msg = getHighlightMsg(my_products);

    //COUNT MINIMAL STATS
    const prcnt_per_page = getPrcntPerPage(
        products_data.length,
        my_products.length
    );
    const prcnt_msg = `\n Сколько твоих обьяв в проценте: **${addBackslash(
        prcnt_per_page + ""
    )}\\%**\n`;
    //ADD TO COUNT STATS PER n STEPS
    prcnt_per_n_steps_arr.push(prcnt_per_page);

    //COUNT STATS PER n STEPS
    let prcnt_per_n_steps = "";
    if (prcnt_per_n_steps_arr.length >= 5) {
        prcnt_per_n_steps = await getPrcntNSteps(
            prcnt_per_n_steps_arr,
            prcnt_per_n_steps_arr.length
        );
    }

    //COUPLE ALL MSGS
    const text =
        new_msg +
        change_msg +
        parse_msg +
        my_products_msg +
        prcnt_msg +
        prcnt_per_n_steps;

    await sendText(text);
}
//GOTOVO
async function getPrcntNSteps(prcnts_arr, all_length, type = "") {
    if (type === "daily") {
        prcnts_arr = prcnt_per_day_arr;
        all_length = prcnt_per_n_steps_arr.length;
    }
    let prcnt = prcnts_arr.reduce((acc, curr) => {
        return (acc = acc + +curr);
    }, 0);
    // console.log(prcnt);
    prcnt = all_length !== 0 ? (prcnt / all_length).toFixed(2) : 0;
    if (type === "daily") {
        prcnt_per_day_arr.push(prcnt);
        prcnt_per_n_steps_arr = [];

        return `\n\nЗа день твои обьявления в среднем занимают **${addBackslash(
            prcnt + ""
        )}\\%** из всех`;
    } else {
        prcnt_per_day_arr = [];
        prcnt_per_n_steps_arr = [];

        return `\n\nЗа последние 5 проходок твои обьявления в среднем занимают **${addBackslash(
            prcnt + ""
        )}\\%** из всех`;
    }
}

//GOTOVO
function getPrcntPerPage(all, my) {
    return ((my * 100) / all).toFixed(2);
}

// GOTOVO
function getHighlightMsg(arr) {
    if (arr.length === 0)
        return `**твои обьявления не попались вообще на первой странице**`;

    const one_msg_per_product = arr.map((item, index) => {
        const keys = Object.keys(item.positionCount);
        return `${index + 1}\\. [${addBackslash(item.title || item.id)}](${
            item.url
        }) : **${keys.join(",")}** ${item.adFlag ? `*РЕКЛАМА*` : ""}`;
    });

    const msg = `Твои обьявления на первой странице: \\(title : positions\\)\n\n${one_msg_per_product.join(
        "\n"
    )}`;
    return msg;
}

//GOTOVO
function getMessageAboutNewProducts(arr) {
    //we have arr info and can show it on msg if we need
    if (arr.length === 0)
        return `Новых продуктов на странице не появилось\\!\n\n`;

    return `${arr.length} продуктов появилось на первой странице и были записанны в бд\n\n`;
}

//gotovo
function getMessageAboutChangedProducts(arr) {
    if (arr.length === 0)
        return `Продукты которые были в бд не изменились после парсинга\\. 0 Изменений\n\n`;

    const change_msg = arr.map((item) => {
        return `[${addBackslash(item.creatorName || item.id)}](${
            item.url
        }): ${item.diff.join(",")}`;
    });
    return `${
        arr.length
    } продуктов изменились с последнего парсинга:\n${change_msg.join(
        "\n"
    )}\n\n`;
}

//GOTOVO
function getMessageAboutParsedProducts(arr) {
    if (arr.length === 0) return `Не удалось спарсить данные\n`;

    const show_more_then_on_time = [];
    const top_show = [];
    let i = 1;
    for (let j = 0; j < arr.length; j++) {
        if (arr[j].adFlag) continue;
        const show_keys = Object.keys(arr[j].positionCount);
        if (show_keys.length > 1) {
            show_more_then_on_time.push(
                `${addBackslash(
                    arr[j].creatorName || arr[j].id
                )}: ${show_keys.join(",")}`
            );
        }
        top_show.push(
            `${i}\\. [${addBackslash(arr[j].creatorName || arr[j].id)}](${
                arr[j].url
            })`
        );
        i++;

        if (+top_show.length === +TOP_COUNT) break;
    }

    //SHOW TOP n POSITION OF PRODUCTS WITHOUT ad`s product
    let msg = `Top ${TOP_COUNT} products on page:\n${top_show.join("\n")}\n`;

    //SHOW DUPLICATES
    if (show_more_then_on_time.length > 0) {
        msg =
            msg +
            `Показались на странице несколько раз \\(после: их позиции\\):\n${show_more_then_on_time.join(
                "\n"
            )}`;
    }
    msg += `\n\\(рекламные не учитывали\\!\\)\n\n`;
    // console.log(top_show);
    return msg;
}

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));

function initBotCommands() {
    bot.hears(/id/gi, (ctx) => {
        const id = ctx.message.chat.id;
        // console.log(id);
        ctx.reply(`Ваш ID: ${id}`);
    });

    //to reload server if it use pm2
    bot.hears(/rs/gi, (ctx) => {
        exec("pm2 restart all", (error, stdout, stderr) => {
            if (error) {
                console.error(`Ошибка выполнения команды: ${error}`);
                return;
            }

            console.log(`stdout: ${stdout}`);
            console.error(`stderr: ${stderr}`);
        });
    });
}

function startBot(bot) {
    initBotCommands();
    bot.launch();
    console.log("Бот запущен");
}

function stopBot(bot) {
    bot.stop();
}

function addBackslash(str = "неизвестно") {
    if (typeof str !== "string") str = str + "";
    const specialChars = "|()*#.!_[]`~+-={}"; // Список специальных символов
    let result = "";

    for (let i = 0; i < str.length; i++) {
        if (specialChars.includes(str[i])) {
            result += "\\"; // Добавляем символ "\\" перед специальным символом
            // result += "\\"; // Добавляем символ "\\" перед специальным символом
        }
        result += str[i];
    }

    return result;
}

module.exports = { notifyAboutParse, sendText, getPrcntNSteps };
