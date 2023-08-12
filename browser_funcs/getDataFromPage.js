// const env = require("dotenv");

// env.config();

async function getDataFromPage(browser, urlsArr, conf = {}) {
    const openDate = Date.now();
    console.log("Go get data from url");

    const { MULTI_PAGE_SIZE } = conf;
    const final_step = Math.ceil(urlsArr.length / MULTI_PAGE_SIZE);
    console.log(`final_step: ${final_step}`);

    let array_of_data = [];
    for (let i = 1; i <= final_step; i++) {
        console.log("STEP: " + i);
        const step_array = [];
        const lower_step = i * MULTI_PAGE_SIZE - MULTI_PAGE_SIZE;
        const start_step = i * MULTI_PAGE_SIZE - 1;

        for (let j = start_step; j >= lower_step; j--) {
            const elem = urlsArr[j];
            try {
                const page = await browser.newPage();
                if (elem) step_array.push(fetchData(elem, page));
            } catch (err) {
                //if err - we skip this url
                // mb need to send msg to bot
                console.log("ERR: CANT OPEN PAGE");
                console.log(j);
            }
        }
        try {
            const data = await Promise.all(step_array);
            array_of_data = [...array_of_data, ...data.filter((item) => item)];
            // break;
        } catch (err) {
            console.log("TOP ERR");
            console.log("SKIP");
            console.log(err);
        }
    }
    // console.log(array_of_data);

    const closeDate = Date.now() - openDate;
    console.log(
        `time to get all DATA from urls:  ${Math.floor(closeDate / 1000)}`
    );
    return array_of_data;

    //Functions
    async function fetchData(obj, page) {
        // RETURN NULL IF SOME ERROR
        try {
            await page.goto(obj.url, {
                timeout: 60 * 1000,
                waitUntil: "networkidle2",
            });
        } catch (err) {
            console.log("CAN`T GO TO URL");
            console.log(err);
            return null;
        }
        // page.w;

        let data = {};
        try {
            data = await page.evaluate(getDataFromPage);
        } catch (err) {
            console.log("err while fetch evaluate");
            console.log(err);
            return null;
        }
        try {
            await page.close();
        } catch (err) {
            console.log("CAN`T CLOSE FUCKING PAGE");
        }
        // console.log(data);
        return {
            ...obj,
            ...data,
        };
    }

    function getDataFromPage() {
        const creatorNameSelector = 'a[data-testid="user-profile-link"] h4';
        const titleSelector = 'h1[data-cy="ad_title"]';
        // const idSelector = 'div[data-cy="ad-footer-bar-section"] > span';
        // const phoneSelector = 'button[data-cy="ad-contact-phone"] > span > a';
        const revisionSelector = 'span[data-testid="page-view-text"]';
        const createDateSelector = 'span[data-cy="ad-posted-at"]';
        const productTypeSelector = "ul.css-sfcl1s p span";
        const descriptionSelector = 'div[data-cy="ad_description"] div';

        const r_data = {
            creatorName: getValue(creatorNameSelector),
            title: getValue(titleSelector),
            // phone: getValue(phoneSelector).split(" ").join(""),
            // id: getValue(idSelector),
            revision: getValue(revisionSelector),
            createDate: getValue(createDateSelector),
            productType: getValue(productTypeSelector),
            description: getValue(descriptionSelector),
        };

        return r_data;

        function getValue(selector = null) {
            if (!selector) return "";
            try {
                return document.querySelector(selector).innerHTML;
            } catch (err) {
                console.log(err);
                return "";
            }
        }
    }
}

module.exports = getDataFromPage;
