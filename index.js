const env = require("dotenv");
const mongoose = require("mongoose");
const getUrlsFromCategory = require("./browser_funcs/getUrlsFromCategory");
const getDataFromPage = require("./browser_funcs/getDataFromPage");
const { default: puppeteer } = require("puppeteer");

var moment = require("moment"); // require
const {
    checkInDbByUrl,
    updProductData,
    addManyUrls,
    updPosition,
} = require("./mongo_funcs/db_funcs");
const { notifyAboutParse, sendText, getPrcntNSteps } = require("./bot");

// moment().format();
env.config();

const startTime = +process.env.START_TIME || null;
const endTime = +process.env.END_TIME || null;
const serverPlusTime = +process.env.SERVER_PLUS_TIME || 3;

const __SYSTEM = process.env.SYSTEM || "linux";
const TARGET_URL = process.env.TARGET_URL;
const MULTI_PAGE_SIZE = process.env.MAX_OPEN_WINDOW || 2;
const HIGHLIGHT_TEXT = process.env.HIGHLIGHT_TEXT || null;

mongoose.set("strictQuery", false);
async function connectToDb() {
    try {
        await mongoose.connect(process.env.MONGO_URL);
        console.log("DB Connected!");

        return true;
    } catch (err) {
        // SEND DB IS DEAD
        await sendText(`Бд упало`);
        return false;
    }
}

async function checkDbConnection() {
    const state = mongoose.connection.readyState;
    // console.log(state);
    const states = [false, true, false, false];
    if (states[state]) {
        return states[state];
    } else {
        if (await connectToDb()) {
            return await checkDbConnection();
        }
        await sleep(1000 * 10);
        await checkDbConnection();
    }
    /*
    0: disconnected
    1: connected
    2: connecting
    3: disconnecting
    */
}

async function openBrowser() {
    if (__SYSTEM === "linux") {
        return await puppeteer.launch({
            headless: "new",
            executablePath: "/usr/bin/chromium-browser",
            args: [
                "--disable-gpu",
                "--disable-setuid-sandbox",
                "--no-sandbox",
                "--no-zygote",
            ],
        });
    }
    return await puppeteer.launch({
        headless: false,
    });
}

async function startServer() {
    //Start with db, if no db == no start
    await checkDbConnection();

    let browser = "";
    try {
        browser = await openBrowser();
        browser.on("disconnected", () => {
            console.log("OFFFF");
        });
        console.log("Browse ON!");
    } catch (err) {
        // await browser.close();
        console.log(err);
        console.log("Error while start browser. Try restart in 10 sec");
        await sleep(1000 * 10);
        startServer();
        return;
    }

    console.log("go take all urls");

    // STEP 1
    //return uniq urls from page with position number and count
    const url_from_target_category = await getUrlsFromCategory(
        browser,
        TARGET_URL
    );
    if (!url_from_target_category) {
        await sendText(`Не смогли открыть страницу, перезапуск через 10 сек`);
        await browser.close();
        await sleep(1000 * 10);
        startServer();
        return;
    }

    //STEP 2
    //RETURN FULL DATA OF PRODUCT BY URLS FROM STEP 1.
    const products_data = await getDataFromPage(
        browser,
        url_from_target_category,
        {
            MULTI_PAGE_SIZE,
        }
    );
    // console.log(products_data);

    //STEP 3
    // LETS CHECK PRODUCTS FOR new/old (in db or not)
    const [foundProducts, notFoundUrls] = await checkInDbByUrl(products_data);

    //STEP 4
    //If length > 0 - change data about position and save to db
    if (foundProducts.length > 0) {
        // console.log("Изменяем статистику общую по позициям...");
        await changePositionData(products_data, foundProducts);
    }

    // Add new products to db
    let new_products = [];
    if (notFoundUrls.length > 0) {
        console.log("Добавляем новые продукты в бд");
        new_products = await addManyUrls(notFoundUrls);
    }

    //now lets look what is changed from last time parse
    const changed_products = checkDifference(products_data, [
        ...foundProducts,
        ...new_products,
    ]);
    // if nothing - do nothin else save in db
    if (changed_products.length > 0) {
        console.log("Изменяем данные продуктов в DB");
        await updProductData(changed_products);
    }

    //get products that we need get info better in msg
    const my_products = getHighlightProducts(products_data);
    /*
        Now we have:
        changed_products - list of products were changed
        new_products     - list of new products
        products_data   - list of all parsed products
        my_products     - list of our products
    */
    await browser.close();
    await notifyAboutParse({
        products_data,
        new_products,
        changed_products,
        my_products,
    });

    const nowTime = +moment().format("HH") + serverPlusTime; // +3 zona servera

    // WE CAN DO PAUSE (like work time or not)
    //IF NOT WE HAVE NO STATS BY DAY
    if (startTime && endTime) {
        console.log(`time: ${nowTime}h`);
        if (+nowTime >= endTime || +nowTime < startTime) {
            let goSleep = 0;
            if (+nowTime < startTime) {
                goSleep = startTime - +nowTime;
            } else {
                goSleep = 24 - +nowTime + startTime;
            }
            console.log(`goSleep: ${goSleep}`);
            const prcnt_by_day_msg = await getPrcntNSteps(null, null, "daily");
            await sendText(prcnt_by_day_msg);
            await sendText(`Уходим в сон на ${goSleep} часов\\! Пока`);
            await sleep(1000 * 60 * 60 * goSleep);
            await sendText(
                `Проснулись улыбнулись и снова на завод нахуй\\! Начинаем работу`
            );
            console.log("Start server after sleep;");
            startServer();
        } else {
            console.log("No sleep, go server");
            startServer();
        }
    } else {
        startServer();
    }
}

//Additional functions

function getHighlightProducts(arr) {
    if (!HIGHLIGHT_TEXT) return [];

    const highlightProducts = arr.filter((item) => {
        return !item?.description || item.description.includes(HIGHLIGHT_TEXT);
    });

    return highlightProducts;
}
//check what is differnce
function checkDifference(parsedArray, dbArray) {
    const differenceArray = [];
    for (let i = 0; i < parsedArray.length; i++) {
        const checkElem = dbArray.find((el) => el.url === parsedArray[i].url);
        const diff = [];
        if (checkElem.title !== parsedArray[i].title) {
            diff.push("Заголовок");
        }
        if (checkElem.createDate !== parsedArray[i].createDate) {
            diff.push("Дата создания");
        }
        // if (checkElem.description !== parsedArray[i].description) {
        //     diff.push("Описание");
        // }
        if (checkElem.creatorName !== parsedArray[i].creatorName) {
            diff.push("Создатель обьявления");
        }

        if (diff.length > 0) {
            console.log(diff);
            differenceArray.push({
                ...parsedArray[i],
                _id: checkElem._id,
                diff,
            });
        }
    }

    return differenceArray;
}

async function changePositionData(parsedData, arrayFromDb) {
    for (let i = 0; i < arrayFromDb.length; i++) {
        const parsedElem = parsedData.find(
            (el) => el.url === arrayFromDb[i].url
        );

        //add position times
        for (const pos in parsedElem.positionCount) {
            // console.log(pos);
            if (parsedElem.positionCount[pos]) {
                if (arrayFromDb[i].positionCount[pos]) {
                    arrayFromDb[i].positionCount[pos] +=
                        parsedElem.positionCount[pos];
                } else {
                    arrayFromDb[i].positionCount[pos] =
                        parsedElem.positionCount[pos];
                }
            }
        }
    }

    await updPosition(arrayFromDb);
    // console.log(arrayFromDb);
}

startServer();
/*

    
}

function checkOnDupl(parsedArray) {
    const dupls = parsedArray.reduce((curr, acc) => {
        // console.log(acc);
        // console.log(__includes(acc, curr));
        // const check_include = curr.filter((el) => el.url === acc.url);
        // let dupl_element = false;
        let index = false;

        for (let i = 0; i < curr.length; i++) {
            if (curr[i].url === acc.url) {
                // dupl_element = curr[i];
                index = i;
            }
        }
        // console.log(index);
        if (index !== false) {
            // console.log("dupl");
            const r_arr = [...curr];
            r_arr[index].positionCount = {
                ...r_arr[index].positionCount,
                ...acc.positionCount,
            };
            return r_arr;
        } else {
            return [...curr, acc];
        }
    }, []);

    if (parsedArray.length !== dupls.length) {
        console.log("Некоторые обьявления появились несколько раз!");
    }
    return dupls;
    // console.log(parsedArray.length);
    // console.log(dupls.length);
}

async function changePositionData(parsedData, arrayFromDb) {
    for (let i = 0; i < arrayFromDb.length; i++) {
        const parsedElem = parsedData.find(
            (el) => el.url === arrayFromDb[i].url
        );

        //add position times
        for (const pos in parsedElem.positionCount) {
            // console.log(pos);
            if (parsedElem.positionCount[pos]) {
                if (arrayFromDb[i].positionCount[pos]) {
                    arrayFromDb[i].positionCount[pos] +=
                        parsedElem.positionCount[pos];
                } else {
                    arrayFromDb[i].positionCount[pos] =
                        parsedElem.positionCount[pos];
                }
            }
        }
    }

    await updPosition(arrayFromDb);
    // console.log(arrayFromDb);
}

function checkDifference(parsedArray, dbArray) {
    const differenceArray = [];
    for (let i = 0; i < parsedArray.length; i++) {
        const checkElem = dbArray.find((el) => el.url === parsedArray[i].url);
        const diff = [];
        if (checkElem.title !== parsedArray[i].title) {
            diff.push("Заголовок");
        }
        if (checkElem.createDate !== parsedArray[i].createDate) {
            diff.push("Дата создания");
        }
        if (checkElem.description !== parsedArray[i].description) {
            diff.push("Описание");
        }
        if (checkElem.creatorName !== parsedArray[i].creatorName) {
            diff.push("Создатель обьявления");
        }

        //TEMP OFF
        // if (checkElem.adFlag !== parsedArray[i].adFlag) {
        //     diff.push(
        //         parsedArray[i].adFlag
        //             ? "Пропатили рекламу"
        //             : "Реклама закончилась"
        //     );
        // }

        if (diff.length > 0) {
            console.log(diff);
            differenceArray.push({
                ...parsedArray[i],
                _id: checkElem._id,
                diff,
            });
        }
    }

    return differenceArray;
}


startServer();
*/

function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}
