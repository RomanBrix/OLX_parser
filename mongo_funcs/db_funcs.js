// const MyProduct = require("./MyProductModel");
const Product = require("../Models/ProductModel");
// const __diff = require("lodash.difference");

// async function getUrlsToCheckWithoutOur(arr) {
//     try {
//         const db_myProducts = (await MyProduct.find({}).lean()).map(
//             (item) => item.url
//         );
//         // const myData = arr.filter((item) => db_myProducts.includes(item.url));
//         const notInDb = arr.filter((item) => !db_myProducts.includes(item.url));
//         console.log(
//             `All urls: ${arr.length}\nmy products: ${db_myProducts.length}\nnotInDb: ${notInDb.length}`
//         );
//         return notInDb;
//     } catch (error) {
//         console.log(err);
//         // return false;
//         return [];
//     }
// }
// async function saveMyProducts(array) {
//     try {
//         const db_myProducts = (await MyProduct.find({}).lean()).map(
//             (item) => item.url
//         );

//         // const toSave = __diff(array, db_myProducts);
//         const toSave = array.filter(
//             (item) => !db_myProducts.includes(item.url)
//         );
//         if (toSave.length) {
//             // console.log(toSave);
//             console.log(
//                 `Go save my products: ${toSave.length}\nnot Filtered len: ${array.length}\nWas: ${db_myProducts.length}`
//             );
//             const myProducts = await MyProduct.insertMany(toSave);
//             return myProducts;
//         }
//         return true;
//     } catch (err) {
//         console.log(err);
//         return false;
//     }
// }

async function addManyUrls(array) {
    try {
        const products = await Product.insertMany(array);
        return products;
    } catch (err) {
        console.log(err);
        return false;
    }
}

async function fetAllProducts() {
    try {
        const products = await Product.find({}, "-description").lean();
        console.log("check prod: ");
        console.log(products[0]);
        return products;
    } catch (err) {
        console.log(err);
        return false;
    }
}

//
async function updProductData(arrayOfChange) {
    try {
        const updates = arrayOfChange.map((data) => {
            const { positionCount, diff, ...other } = data;
            return {
                updateOne: {
                    filter: { _id: data._id },
                    update: { ...other },
                },
            };
        });

        const result = await Product.bulkWrite(updates);

        console.log(result.modifiedCount);
        return result.modifiedCount;
    } catch (err) {
        console.log(err);
        return false;
    }
}

async function updPosition(arrayData) {
    try {
        const updates = arrayData.map((data) => ({
            updateOne: {
                filter: { _id: data._id },
                update: { positionCount: data.positionCount },
            },
        }));

        const result = await Product.bulkWrite(updates);

        return result.modifiedCount;
    } catch (err) {
        console.log(err);
        return false;
    }
}

//
async function checkInDbByUrl(arrayOfUrls) {
    try {
        const products = Product.aggregate([
            { $project: { description: false } },
            { $match: { url: { $in: arrayOfUrls.map((obj) => obj.url) } } },
            { $group: { _id: "$url", products: { $push: "$$ROOT" } } },
        ])
            .then((result) => {
                const foundProducts = result
                    .map((group) => group.products)
                    .flat();
                const notFoundUrls = arrayOfUrls.filter(
                    (obj) =>
                        !foundProducts.some(
                            (product) =>
                                product.url === obj.url || product.id == obj.id
                        )
                );

                return [foundProducts, notFoundUrls];
            })
            .catch((err) => {
                console.log(err);
                return [false, false];
            });
        return ([foundProducts, notFoundUrls] = await products);
    } catch (err) {
        console.log(err);
        return false;
    }
}

module.exports = {
    addManyUrls,
    fetAllProducts,
    checkInDbByUrl,
    updPosition,
    updProductData,

    // saveMyProducts,
    // getUrlsToCheckWithoutOur,
};
