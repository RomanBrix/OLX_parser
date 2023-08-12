var mongoose = require("mongoose");
var Schema = mongoose.Schema;

var productSchema = new Schema(
    {
        title: { type: String },
        url: { type: String, unique: true },
        id: { type: String, unique: true },
        revision: { type: String },
        createDate: { type: String },
        description: { type: String },
        creatorName: { type: String },
        // phone: { type: String },
        // map: { type: String },
        productType: { type: String },
        adFlag: { type: Boolean },
        positionCount: {
            type: Object,
            default: {},
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model("Product", productSchema);
