/*
* GET home page.
*/
var fs = require('fs');
var lpsolve = require('./node_modules/lp_solve/index.js');

exports.runHllLogisticsOptimizationModel = function (pathToFiles, selectedScenario, callback) {
    console.log('Model is running using files from ' + pathToFiles + ' folder :)');
    var demandKeys = [];
    var demandValues = [];
    var costValues = [];

    //        var lpsolve = require('lp_solve');
    var Row = lpsolve.Row;

    var objective = new Row();
    var lp = new lpsolve.LinearProgram();

    var outputLog = [];
    var x = [];


    console.log('Reading demand data');
    fs.readFile(pathToFiles + 'Demand.csv', function (err, data) {
        if (err) {
            console.log(err);
        }
        else {
            data = data.toString().replace(/\r/ig, "");
            var lines = data.toString().split("\n");
            for (var i = 1; i < lines.length; i++) {
                var fields = lines[i].split(",");
                if (fields.length == 6 && parseFloat(fields[5]) > 0) {
                    demandKeys.push(fields[0] + "_" + fields[1] + "_" + fields[2] + "_" + fields[3] + "_" + fields[4]);
                    demandValues.push({ modelVariable: 'x' + i.toString(), key: fields[0] + "_" + fields[1] + "_" + fields[2] + "_" + fields[3] + "_" + fields[4], demand: parseFloat(fields[5]), costValues: [], xy: [] });
                    x.push(lp.addColumn('x' + i.toString()));
                }
            }

            //            var WHPickupKeys = [];
            //            var WHPickupValues = [];
            //            console.log('Reading WH Pickup constraint');
            //            fs.readFile(pathToFiles + 'WHPickupConstraint.csv', function (err, data) {
            //                if (err) {
            //                    console.log(err);
            //                }
            //                else {
            //                    data = data.toString().replace(/\r/ig, "");
            //                    var lines = data.toString().split("\n");
            //                    for (var i = 1; i < lines.length; i++) {
            //                        var fields = lines[i].split(",");
            //                        if (fields.length == 3) {
            //                            WHPickupKeys.push(fields[0]);
            //                            WHPickupValues.push({ key: fields[0], minValue: parseFloat(fields[1]), maxValue: parseFloat(fields[2]), xy: [] });
            //                        }
            //                    }

            var SupplyLocationTruckTypeKeys = [];
            var SupplyLocationTruckTypeValues = [];
            var custPrefInfeasibility = [];
            console.log('Reading Supply Location Constraint');
            fs.readFile(pathToFiles + 'SupplyLocationTruckTypeConstraint.csv', function (err, data) {
                if (err) {
                    console.log(err);
                }
                else {
                    data = data.toString().replace(/\r/ig, "");
                    var lines = data.toString().split("\n");
                    for (var i = 1; i < lines.length && selectedScenario["SupplyLocationTruckTypeConstraint"]; i++) {
                        var fields = lines[i].split(",");
                        if (fields.length == 5) {
                            SupplyLocationTruckTypeKeys.push(fields[0] + "_" + fields[1] + "_" + fields[4]);
                            var minValue = parseFloat(fields[3]);
                            if (isNaN(minValue)) {
                                minValue = 0;
                            }
                            var maxValue = parseFloat(fields[2]);
                            if (isNaN(maxValue)) {
                                maxValue = Math.pow(10, 20);
                            }
                            SupplyLocationTruckTypeValues.push({ key: fields[0] + "_" + fields[1] + "_" + fields[4], maxValue: maxValue, minValue: minValue, xy: [] });
                        }
                    }

                    var IUDKeys = [];
                    var IUDValues = [];
                    console.log('Reading IUD Constraint');
                    fs.readFile(pathToFiles + 'IUDConstraint.csv', function (err, data) {
                        if (err) {
                            console.log(err);
                        }
                        else {
                            data = data.toString().replace(/\r/ig, "");
                            var lines = data.toString().split("\n");
                            for (var i = 1; i < lines.length && selectedScenario["IUDConstraint"]; i++) {
                                var fields = lines[i].split(",");
                                if (fields.length == 3) {
                                    IUDKeys.push(fields[0] + '_' + fields[1]);
                                    var minValue = parseFloat(fields[2]);
                                    if (isNaN(minValue)) {
                                        minValue = 0;
                                    }
                                    IUDValues.push({ key: fields[0] + '_' + fields[1], minValue: minValue, xy: [] });
                                }
                            }
                            var ProdCapKeys = [];
                            var ProdCapValues = [];
                            console.log('Reading capacity production');
                            fs.readFile(pathToFiles + 'capacityProduction.csv', function (err, data) {
                                if (err) {
                                    console.log(err);
                                }
                                else {
                                    data = data.toString().replace(/\r/ig, "");
                                    var lines = data.toString().split("\n");
                                    for (var i = 1; i < lines.length && selectedScenario["ProductionCapacityConstraint"]; i++) {
                                        var fields = lines[i].split(",");

                                        if (fields.length == 3) {
                                            ProdCapKeys.push(fields[0] + '_' + fields[1]);
                                            var maxValue = parseFloat(fields[2]);
                                            if (isNaN(maxValue)) {
                                                maxValue = Math.pow(10, 20);
                                            }
                                            ProdCapValues.push({ key: fields[0] + '_' + fields[1], maxValue: maxValue, xy: [] });
                                        }
                                    }
                                    var TransCapKeys = [];
                                    var TransCapValues = [];
                                    console.log('Reading capacity transportation');
                                    fs.readFile(pathToFiles + 'capacityTransportation.csv', function (err, data) {
                                        if (err) {
                                            console.log(err);
                                        }
                                        else {
                                            data = data.toString().replace(/\r/ig, "");
                                            var lines = data.toString().split("\n");
                                            for (var i = 1; i < lines.length && selectedScenario["TransportationCapacityConstraint"]; i++) {
                                                var fields = lines[i].split(",");
                                                if (fields.length == 2) {
                                                    TransCapKeys.push(fields[0]);
                                                    var maxValue = parseFloat(fields[1]);
                                                    if (isNaN(maxValue)) {
                                                        maxValue = Math.pow(10, 20);
                                                    }
                                                    TransCapValues.push({ key: fields[0], maxValue: maxValue, xy: [] });
                                                }
                                            }
                                            var PrefKeys = [];
                                            var PrefValues = [];
                                            console.log('Reading customer preference');
                                            fs.readFile(pathToFiles + 'customerPreference.csv', function (err, data) {
                                                if (err) {
                                                    console.log(err);
                                                }
                                                else {
                                                    data = data.toString().replace(/\r/ig, "");
                                                    var lines = data.toString().split("\n");
                                                    if (lines.length > 0) {
                                                        custPrefInfeasibility.push(lines[0]);
                                                    }
                                                    for (var i = 1; i < lines.length && selectedScenario["CustomerPreferenceConstraint"]; i++) {
                                                        var fields = lines[i].split(",");
                                                        if (fields.length == 8) {
                                                            PrefKeys.push(fields[0] + '_' + fields[1] + '_' + fields[2] + '_' + fields[3] + '_' + fields[4] + '_' + fields[5] + '_' + fields[6] + '_' + fields[7]);
                                                            PrefValues.push({ key: fields[0] + '_' + fields[1] + '_' + fields[2] + '_' + fields[3] + '_' + fields[4] + '_' + fields[5] + '_' + fields[6] + '_' + fields[7], maxValue: 0, xy: [] });
                                                        }
                                                    }
                                                    console.log('Reading freight/rebate');
                                                    fs.readFile(pathToFiles + 'Freight_Rebate.csv', function (err, data) {
                                                        if (err) {
                                                            console.log(err);
                                                        }
                                                        else {
                                                            data = data.toString().replace(/\r/ig, "");
                                                            var lines = data.toString().split("\n");
                                                            for (var i = 1; i < lines.length; i++) {
                                                                var fields = lines[i].split(",");
                                                                if (fields.length == 17) {
                                                                    var index = demandKeys.indexOf(fields[0] + "_" + fields[1] + "_" + fields[2] + "_" + fields[3] + "_" + fields[4]);
                                                                    if (index > -1) {
                                                                        demandValues[index].costValues.push({ modelVariable: 'y' + (demandValues[index].costValues.length + 1).toString(), key: fields[5] + "_" + fields[6] + "_" + fields[7], cost: parseFloat(fields[14]), otherParams: fields[8] + "_" + fields[9] + "_" + fields[10] + "_" + fields[11] + "_" + fields[12] + "_" + fields[13] + "_" + fields[14] + "_" + fields[15] + "_" + fields[16] });
                                                                        demandValues[index].xy.push(lp.addColumn('x' + (index + 1).toString() + '_' + 'y' + (demandValues[index].costValues.length).toString()));
                                                                        objective = objective.Add(demandValues[index].xy[demandValues[index].xy.length - 1], demandValues[index].costValues[demandValues[index].costValues.length - 1].cost);

                                                                        var IUDIndex = IUDKeys.indexOf(fields[5] + "_" + fields[6]);
                                                                        if (IUDIndex > -1) {
                                                                            IUDValues[IUDIndex].xy.push(demandValues[index].xy[demandValues[index].xy.length - 1]);
                                                                        }

                                                                        //                                                                        var WHPickupIndex = WHPickupKeys.indexOf(fields[6]);
                                                                        //                                                                        if (WHPickupIndex > -1) {
                                                                        //                                                                            WHPickupValues[WHPickupIndex].xy.push(demandValues[index].xy[demandValues[index].xy.length - 1]);
                                                                        //                                                                        }

                                                                        var SupplyLocationTruckTypeIndex = SupplyLocationTruckTypeKeys.indexOf(fields[6] + "_" + fields[7] + "_" + fields[4]);
                                                                        if (SupplyLocationTruckTypeIndex > -1) {
                                                                            SupplyLocationTruckTypeValues[SupplyLocationTruckTypeIndex].xy.push(demandValues[index].xy[demandValues[index].xy.length - 1]);
                                                                        }

                                                                        var ProdCapIndex = ProdCapKeys.indexOf(fields[5] + "_" + fields[3]);
                                                                        if (ProdCapIndex > -1) {
                                                                            ProdCapValues[ProdCapIndex].xy.push(demandValues[index].xy[demandValues[index].xy.length - 1]);
                                                                        }

                                                                        ProdCapIndex = ProdCapKeys.indexOf(fields[5] + "_");
                                                                        if (ProdCapIndex > -1) {
                                                                            ProdCapValues[ProdCapIndex].xy.push(demandValues[index].xy[demandValues[index].xy.length - 1]);
                                                                        }

                                                                        var TransCapIndex = TransCapKeys.indexOf(fields[7]);
                                                                        if (TransCapIndex > -1) {
                                                                            TransCapValues[TransCapIndex].xy.push(demandValues[index].xy[demandValues[index].xy.length - 1]);
                                                                        }

                                                                        //                                                                        var PrefIndex = PrefKeys.indexOf(fields[0] + '_' + fields[1] + '_' + fields[2] + '_' + fields[3] + '_' + fields[4] + '_' + fields[5] + '_' + fields[6] + '_' + fields[7]);
                                                                        //                                                                        if (PrefIndex > -1) {
                                                                        //                                                                            PrefValues[PrefIndex].xy.push(demandValues[index].xy[demandValues[index].xy.length - 1]);
                                                                        //                                                                        }
                                                                        for (var PrefIndex = 0; PrefIndex < PrefValues.length; PrefIndex++) {
                                                                            var myKeys = PrefValues[PrefIndex].key.split("_");
                                                                            var found = true;
                                                                            for (var myKeyIndex = 0; myKeyIndex < myKeys.length && found == true; myKeyIndex++) {
                                                                                if (myKeys[myKeyIndex] != '' && myKeys[myKeyIndex] != fields[myKeyIndex]) {
                                                                                    found = false;
                                                                                }
                                                                                else {
                                                                                    //console.log(['PrefIndex:' + PrefIndex + ":" + PrefValues[PrefIndex].key] + ":" + fields);
                                                                                }
                                                                            }
                                                                            if (found == true) {
                                                                                PrefValues[PrefIndex].xy.push(demandValues[index].xy[demandValues[index].xy.length - 1]);
                                                                                objective = objective.Add(demandValues[index].xy[demandValues[index].xy.length - 1], 100000000);
                                                                            }
                                                                        }
                                                                    }
                                                                }
                                                            }

                                                            lp.setObjective(objective);

                                                            var demandConstraint = [];
                                                            for (var i = 0; i < demandValues.length; i++) {
                                                                demandConstraint.push(new Row());
                                                                if (demandValues[i].xy.length > 0) {
                                                                    for (var j = 0; j < demandValues[i].xy.length; j++) {
                                                                        demandConstraint[i] = demandConstraint[i].Add(demandValues[i].xy[j], 1);
                                                                    }
                                                                    lp.addConstraint(demandConstraint[i], 'EQ', demandValues[i].demand, demandValues[i].variable + ' demand (' + demandValues[i].key + ')');
                                                                } else {
                                                                    lp.addConstraint(demandConstraint[i], 'EQ', 0, demandValues[i].variable + ' demand (' + demandValues[i].key + ')');
                                                                }
                                                            }

                                                            var UIDConstraint = [];
                                                            for (var i = 0; i < IUDValues.length; i++) {
                                                                UIDConstraint.push(new Row());
                                                                if (IUDValues[i].xy.length > 0) {
                                                                    for (var j = 0; j < IUDValues[i].xy.length; j++) {
                                                                        UIDConstraint[i] = UIDConstraint[i].Add(IUDValues[i].xy[j], 1);
                                                                    }
                                                                    lp.addConstraint(UIDConstraint[i], 'GE', IUDValues[i].minValue, ' IUD (' + IUDValues[i].key + ')');
                                                                } else {
                                                                    lp.addConstraint(UIDConstraint[i], 'EQ', 0, ' IUD (' + IUDValues[i].key + ')');
                                                                }
                                                            }

                                                            //                                                            var WHPickupConstraint = [];
                                                            //                                                            for (var i = 0; i < WHPickupValues.length; i++) {
                                                            //                                                                WHPickupConstraint.push(new Row());
                                                            //                                                                if (WHPickupValues[i].xy.length > 0) {
                                                            //                                                                    for (var j = 0; j < WHPickupValues[i].xy.length; j++) {
                                                            //                                                                        WHPickupConstraint[i] = WHPickupConstraint[i].Add(WHPickupValues[i].xy[j], 1);
                                                            //                                                                    }
                                                            //                                                                    lp.addConstraint(WHPickupConstraint[i], 'GE', WHPickupValues[i].minValue, ' WHPickup_min (' + WHPickupValues[i].key + ')');
                                                            //                                                                    lp.addConstraint(WHPickupConstraint[i], 'LE', WHPickupValues[i].maxValue, ' WHPickup_max (' + WHPickupValues[i].key + ')');
                                                            //                                                                } else {
                                                            //                                                                    lp.addConstraint(WHPickupConstraint[i], 'EQ', 0, ' WHPickup (' + WHPickupValues[i].key + ')');
                                                            //                                                                }
                                                            //                                                            }

                                                            var SupplyLocationTruckTypeConstraint = [];
                                                            for (var i = 0; i < SupplyLocationTruckTypeValues.length; i++) {
                                                                SupplyLocationTruckTypeConstraint.push(new Row());
                                                                if (SupplyLocationTruckTypeValues[i].xy.length > 0) {
                                                                    for (var j = 0; j < SupplyLocationTruckTypeValues[i].xy.length; j++) {
                                                                        SupplyLocationTruckTypeConstraint[i] = SupplyLocationTruckTypeConstraint[i].Add(SupplyLocationTruckTypeValues[i].xy[j], 1);
                                                                    }
                                                                    lp.addConstraint(SupplyLocationTruckTypeConstraint[i], 'LE', SupplyLocationTruckTypeValues[i].maxValue, ' SupplyLocationTruckType_max (' + SupplyLocationTruckTypeValues[i].key + ')');
                                                                    lp.addConstraint(SupplyLocationTruckTypeConstraint[i], 'GE', SupplyLocationTruckTypeValues[i].minValue, ' SupplyLocationTruckType_min (' + SupplyLocationTruckTypeValues[i].key + ')');
                                                                } else {
                                                                    lp.addConstraint(SupplyLocationTruckTypeConstraint[i], 'EQ', 0, ' SupplyLocationTruckType (' + SupplyLocationTruckTypeValues[i].key + ')');
                                                                }
                                                            }

                                                            var ProdCapConstraint = [];
                                                            for (var i = 0; i < ProdCapValues.length; i++) {
                                                                ProdCapConstraint.push(new Row());
                                                                if (ProdCapValues[i].xy.length > 0) {
                                                                    for (var j = 0; j < ProdCapValues[i].xy.length; j++) {
                                                                        ProdCapConstraint[i] = ProdCapConstraint[i].Add(ProdCapValues[i].xy[j], 1);
                                                                    }
                                                                    lp.addConstraint(ProdCapConstraint[i], 'LE', ProdCapValues[i].maxValue, ' ProdCap (' + ProdCapValues[i].key + ')');
                                                                } else {
                                                                    lp.addConstraint(ProdCapConstraint[i], 'EQ', 0, ' ProdCap (' + ProdCapValues[i].key + ')');
                                                                }
                                                            }

                                                            var TransCapConstraint = [];
                                                            for (var i = 0; i < TransCapValues.length; i++) {
                                                                TransCapConstraint.push(new Row());
                                                                if (TransCapValues[i].xy.length > 0) {

                                                                    for (var j = 0; j < TransCapValues[i].xy.length; j++) {
                                                                        TransCapConstraint[i] = TransCapConstraint[i].Add(TransCapValues[i].xy[j], 1);
                                                                    }
                                                                    lp.addConstraint(TransCapConstraint[i], 'LE', TransCapValues[i].maxValue, ' TransCap (' + TransCapValues[i].key + ')');
                                                                } else {
                                                                    lp.addConstraint(TransCapConstraint[i], 'EQ', 0, ' TransCap (' + TransCapValues[i].key + ')');
                                                                }
                                                            }

                                                            var PrefConstraint = [];
                                                            for (var i = 0; i < PrefValues.length; i++) {
                                                                PrefConstraint.push(new Row());
                                                                if (PrefValues[i].xy.length > 0) {
                                                                    for (var j = 0; j < PrefValues[i].xy.length; j++) {
                                                                        PrefConstraint[i] = PrefConstraint[i].Add(PrefValues[i].xy[j], 1);
                                                                    }
                                                                    lp.addConstraint(PrefConstraint[i], 'GE', PrefValues[i].maxValue, ' CustPrefCap (' + PrefValues[i].key + ')');
                                                                } else {
                                                                    lp.addConstraint(PrefConstraint[i], 'EQ', 0, ' CustPref (' + PrefValues[i].key + ')');
                                                                }
                                                            }

                                                            //console.log(lp.dumpProgram());
                                                            var result = lp.solve();
                                                            if (result.code == 0) {
                                                                //                                                                outputLog.push('\n**********  WH Pickup Constraint ***********');
                                                                //                                                                for (var i = 0; i < WHPickupValues.length; i++) {
                                                                //                                                                    var value = 0;
                                                                //                                                                    for (var j = 0; j < WHPickupValues[i].xy.length; j++) {
                                                                //                                                                        if (lp.get(WHPickupValues[i].xy[j]) > 0)
                                                                //                                                                            value += lp.get(WHPickupValues[i].xy[j]);
                                                                //                                                                    }
                                                                //                                                                    outputLog.push("\t" + WHPickupValues[i].key + ' = ' + Math.round(value));
                                                                //                                                                }

                                                                outputLog.push('\n**********  Supply Location Truck Type Constraint ***********');
                                                                for (var i = 0; i < SupplyLocationTruckTypeValues.length; i++) {
                                                                    var value = 0;
                                                                    for (var j = 0; j < SupplyLocationTruckTypeValues[i].xy.length; j++) {
                                                                        if (lp.get(SupplyLocationTruckTypeValues[i].xy[j]) > 0)
                                                                            value += lp.get(SupplyLocationTruckTypeValues[i].xy[j]);
                                                                    }
                                                                    outputLog.push("\t" + SupplyLocationTruckTypeValues[i].key + ' = ' + Math.round(value));
                                                                }

                                                                outputLog.push('\n**********  IUD Constraint ***********');
                                                                for (var i = 0; i < IUDValues.length; i++) {
                                                                    var value = 0;
                                                                    for (var j = 0; j < IUDValues[i].xy.length; j++) {
                                                                        if (lp.get(IUDValues[i].xy[j]) > 0)
                                                                            value += lp.get(IUDValues[i].xy[j]);
                                                                    }
                                                                    outputLog.push("\t" + IUDValues[i].key + ' = ' + Math.round(value));
                                                                }


                                                                outputLog.push('\n**********  Production Capacity Constraint ***********');
                                                                for (var i = 0; i < ProdCapValues.length; i++) {
                                                                    var value = 0;
                                                                    for (var j = 0; j < ProdCapValues[i].xy.length; j++) {
                                                                        if (lp.get(ProdCapValues[i].xy[j]) > 0)
                                                                            value += lp.get(ProdCapValues[i].xy[j]);
                                                                    }
                                                                    outputLog.push("\t" + ProdCapValues[i].key + ' = ' + Math.round(value));
                                                                }

                                                                outputLog.push('\n**********  Transportation Capacity Constraint ***********');
                                                                for (var i = 0; i < TransCapValues.length; i++) {
                                                                    var value = 0;
                                                                    for (var j = 0; j < TransCapValues[i].xy.length; j++) {
                                                                        if (lp.get(TransCapValues[i].xy[j]) > 0)
                                                                            value += lp.get(TransCapValues[i].xy[j]);
                                                                    }
                                                                    outputLog.push("\t" + TransCapValues[i].key + ' = ' + Math.round(value));
                                                                }

                                                                outputLog.push('\n**********  Customer Preference Constraint ***********');
                                                                for (var i = 0; i < PrefValues.length; i++) {
                                                                    var value = 0;
                                                                    for (var j = 0; j < PrefValues[i].xy.length; j++) {
                                                                        if (lp.get(PrefValues[i].xy[j]) > 0)
                                                                            value += lp.get(PrefValues[i].xy[j]);
                                                                    }
                                                                    outputLog.push("\t" + PrefValues[i].key + ' = ' + Math.round(value));
                                                                    if (value > 0)
                                                                        custPrefInfeasibility.push(PrefValues[i].key.split("_").join(","));
                                                                }

                                                                outputLog.push('\n**********  Demand Constraint ***********');
                                                                var finalOutput = [];
                                                                finalOutput.push("Plant,Warehouse,BusinessType,Soldto,Shipto,ProductType,ProductGroup,LoadsizeCode,DeliveryType,Volume,Freight,ProductionCost,PackingCost,ShippingCost,WarehouseCost,TotalCost,PickupRebate,IUDFreightCost");
                                                                for (var i = 0; i < demandValues.length; i++) {
                                                                    var demandKeyFields = demandValues[i].key.split("_");
                                                                    outputLog.push('\ndemand ' + demandValues[i].modelVariable + ' (' + demandValues[i].key + ') = ' + Math.round(lp.calculate(demandConstraint[i])));
                                                                    for (var j = 0; j < demandValues[i].xy.length; j++) {
                                                                        if (lp.get(demandValues[i].xy[j]) > 0) {
                                                                            var volume = lp.get(demandValues[i].xy[j]);
                                                                            outputLog.push(demandValues[i].costValues[j].modelVariable + ' (' + demandValues[i].costValues[j].key + ') = ' + volume);
                                                                            var otherKeyFields = demandValues[i].costValues[j].key.split("_");
                                                                            var otherValues = demandValues[i].costValues[j].otherParams.split("_");
                                                                            var outputFields = [];
                                                                            outputFields.push(otherKeyFields[0]); //Manufacturing Plant
                                                                            outputFields.push(otherKeyFields[1]); //Supplying Plant
                                                                            outputFields.push(demandKeyFields[0]); //BusinessType //B2B,Retail
                                                                            outputFields.push(demandKeyFields[1]); //Sold To
                                                                            outputFields.push(demandKeyFields[2]); //Ship To
                                                                            outputFields.push(demandKeyFields[4]); // Product Type
                                                                            outputFields.push(demandKeyFields[3]); // Product Group
                                                                            outputFields.push(otherKeyFields[2]); //Load Size
                                                                            if (otherKeyFields[2] == 'L0') {
                                                                                if (otherKeyFields[0] == otherKeyFields[1]) {
                                                                                    outputFields.push('Pickup');
                                                                                }
                                                                                else {
                                                                                    outputFields.push('WH Pickup');
                                                                                }
                                                                            }
                                                                            else {
                                                                                outputFields.push('Delivery');
                                                                            }
                                                                            outputFields.push(formatTo3Decimal(volume)); // Volume
                                                                            outputFields.push(formatTo3Decimal(otherValues[1])); //Freight Cost
                                                                            outputFields.push(formatTo3Decimal(otherValues[4])); //Production Cost
                                                                            outputFields.push(formatTo3Decimal(otherValues[5])); //Packing Cost
                                                                            outputFields.push(formatTo3Decimal(otherValues[2])); //Shipping Station Cost
                                                                            outputFields.push(formatTo3Decimal(otherValues[3])); //Warehouse Cost
                                                                            outputFields.push(formatTo3Decimal(otherValues[6])); //Total Cost
                                                                            outputFields.push(formatTo3Decimal(otherValues[7])); //Pickup Rebate
                                                                            outputFields.push(formatTo3Decimal(otherValues[8])); //IUD Freight Cost


                                                                            finalOutput.push(outputFields.join(","));
                                                                        }
                                                                    }
                                                                }
                                                                outputLog.push('\n*************************  Total Cost =' + Math.round(lp.getObjectiveValue()) + ' *************************************');
                                                                //console.log(outputLog.join('\n'));
                                                                //                                                            res.send(outputLog.join('\n').replace(/\n/ig, '<BR>'));
                                                                console.log(selectedScenario);
                                                                if (custPrefInfeasibility.length <= 1) {
                                                                    fs.writeFile(pathToFiles + 'OutputFile_' + selectedScenario["ScenarioName"].replace(/ /ig, "_") + '.csv', finalOutput.join('\n'), function (err) {
                                                                        if (err) {
                                                                            console.log(err);
                                                                        }
                                                                        else {
                                                                            callback({
                                                                                status: true,
                                                                                content: {
                                                                                    message: ""

                                                                                },
                                                                                data: {}
                                                                            });
                                                                            console.log('It\'s saved!');
                                                                        }
                                                                    });
                                                                }
                                                                else {
                                                                    fs.writeFile(pathToFiles + 'Infeasible_CustPref_OutputFile_' + selectedScenario["ScenarioName"].replace(/ /ig, "_") + '.csv', custPrefInfeasibility.join('\n'), function (err) {
                                                                        if (err) {
                                                                            console.log(err);
                                                                        }
                                                                        else {
                                                                            callback({
                                                                                status: false,
                                                                                content: {
                                                                                    message: "Infeasible Output !!!"
                                                                                }
                                                                            });
                                                                        }
                                                                    });
                                                                }
                                                            }
                                                            else {
                                                                callback({
                                                                    status: false,
                                                                    content: {
                                                                        message: "Infeasible Output !!!"
                                                                    }
                                                                });
                                                            }
                                                        }
                                                    });
                                                }
                                            });
                                        }
                                    });
                                }
                            });
                        }
                    });
                    //                    }
                    //                });
                }
            });
        }
    });

}

function formatTo3Decimal(num) {
    return Math.round(num * 1000) / 1000;
}

exports.runHllLogisticsOptimizationModel('D:/axiom/axiomdeployment_hll/trunk/axiomCore/axiomImages/HLL/logisticmodel/ModelFiles_SC303/Model_Input_Files/', { SupplyLocationTruckTypeConstraint: true, IUDConstraint: false, ProductionCapacityConstraint: true, TransportationCapacityConstraint: false, CustomerPreferenceConstraint: false, ScenarioName: 'Custom Scenario' }, function (data) {
   console.log(data);
});

process.on('message', function (m) {
    console.log('CHILD got message:', m);
    if (m.type === "startProcess") {
        exports.runHllLogisticsOptimizationModel(m.path, m.scenario, function (data) {
            process.send(data);
            setTimeout(function () {
                process.exit(0);
            }, 1 * 60 * 1000);
        });
    }
    else {
        process.exit(0);
    }
});
