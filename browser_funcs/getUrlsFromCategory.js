// const puppeteer = require("puppeteer");
// const __union = require("lodash.union");
// const env = require("dotenv");

// env.config();

// console.log(URL);
async function startListen(browser, URL) {
    const openDate = Date.now();

    let page = "";
    try {
        page = await browser.newPage();
        await page.goto(URL, {
            waitUntil: "networkidle2",
        });
    } catch (err) {
        return [];
    }

    let pages = 1;
    let allUrls = [];

    // console.log("Start");
    while (true) {
        console.log(`Check page #${pages}`);
        allUrls = await fetchUrls(allUrls);
        break;
    }

    // END of main function
    const closeDate = Date.now() - openDate;
    console.log(`How many urls ${allUrls.length}`);
    console.log(`time to get all urls:  ${Math.floor(closeDate / 1000)}`);
    await page.close();
    // return allUrls;
    return checkOnDupl(allUrls);

    async function fetchUrls(mainArr) {
        try {
            await page.waitForSelector("div[data-cy='l-card']>a", {
                timeout: 10000, // 5 sec timeout for bad server
            });
            const fetchList = await page.evaluate(evData);
            return [...mainArr, ...fetchList];
        } catch {
            return false;
        }
    }

    //fetch by tags
    function evData() {
        const selector = 'div[data-testid="listing-grid"]';
        const list = document.querySelector(selector);
        const cards = Array.from(list.childNodes).filter(
            (el) => el.dataset?.cy && el.dataset.cy === "l-card"
        );

        const returnedVal = cards.map((el, index) => {
            let positionCount = {
                [1 + index]: 1,
            };
            const id = el.id;
            let adFlag = false;
            try {
                if (
                    document.querySelector(
                        `[id="${id}"] div[data-testid="adCard-featured"]`
                    )
                )
                    adFlag = true;
            } catch (err) {
                adFlag = false;
            }
            return {
                url: el.firstChild.href,
                id,
                adFlag,
                positionCount,
            };
        });
        return returnedVal;
    }
}

function checkOnDupl(parsedArray) {
    const dupls = parsedArray.reduce((curr, acc) => {
        let index = false;
        for (let i = 0; i < curr.length; i++) {
            if (curr[i].url === acc.url) {
                index = i;
            }
        }
        if (index !== false) {
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
}

module.exports = startListen;
