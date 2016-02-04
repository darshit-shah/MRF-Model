var fs = require('fs');
var debug = require('debug')('model:model');
var utils = {
  //example evenDistributionRange({input:[{start:1, end:11}],output:[]}, true);
  evenDistributionRange: function(json, include, cb) {
    var self = this;
    if (json.input.length <= 0) {
      // debug(json.output);
      if (cb) {
        cb(json);
      }
      return;
    }
    var currInput = json.input.shift();
    var start = currInput.start;
    var end = currInput.end;
    if (include === true) {
      json.output.push(start);
      json.output.push(end);
      // console.log("start", start);
      // console.log("end", end);
    }
    var middle = Math.floor((start + end) / 2);
    // console.log("middle", middle);
    json.output.push(middle);
    if (middle - start > 1) {
      json.input.push({
        start: start,
        end: middle
      });
    }
    if (end - middle > 1) {
      json.input.push({
        start: middle,
        end: end
      });
    }
    setTimeout(function() {
      self.evenDistributionRange(json, false, cb);
    }, 1);
  },
  readCSVFile: function(path, fieldsLength, convertUpper) {
    var data = fs.readFileSync(path);
    var rows = data.toString().split("\n");
    for (var rIndex = 0; rIndex < rows.length; rIndex++) {
      if (rows[rIndex].length > 1) {
        rows[rIndex] = rows[rIndex].split(",");
        if (rows[rIndex].length != fieldsLength) {
          console.log(fieldsLength, " fields required. Found: ", rows[rIndex].length, "Data: ", rows[rIndex]);
          throw Error("Field Mismatch");
          process.exit(0);
          rows.splice(rIndex, 1);
          rIndex--;
        } else {
          if (convertUpper !== false) {
            for (var fIndex = 0; fIndex < rows[rIndex].length; fIndex++) {
              rows[rIndex][fIndex] = rows[rIndex][fIndex].toUpperCase();
            }
          }
        }
      } else {
        rows.splice(rIndex, 1);
        rIndex--;
      }
    }
    return rows;
  },
  JSON2CSV: function(objArray, includeHeader) {
    var array = typeof objArray != 'object' ? [objArray] : objArray;
    //console.log(typeof objArray);
    var str = '';
    var tempData = [];
    if (array.length > 0) {
      var keys = Object.keys(array[0]);
      if (includeHeader !== false) {
        //str += keys.join(',') + '\r\n';
        tempData.push(keys.join(','));
      }
      //   console.log('JSON2CSV called for Array Size:', objArray.length, ' and keys size: ', keys.length);
      //append data
      for (var k = 0; k < array.length; k++) {
        var line = [];
        for (var index = 0; index < keys.length; index++) {
          if (array[k].hasOwnProperty(keys[index])) {
            var val = array[k][keys[index]];
            if (typeof val == 'string' && val != null) {
              if (val.indexOf(',') != -1)
                line.push('"' + val + '"');
              else
                line.push(val);
            } else if (Object.prototype.toString.call(val) === '[object Date]') {
              line.push(dateTimeFormat.formatDate(val, "yyyy-MM-dd HH:mm:ss"));
            } else {
              line.push(val);
            }
          }
        }
        //str += line.join(',') + '\r\n';
        tempData.push(line.join(','));
      }
      return tempData.join('\r\n') + '\r\n';
    }
  }
};

var filesDIR = "";
if (process.argv[2] != undefined) {
  filesDIR = process.argv[2];
  if (filesDIR[filesDIR.length - 1] !== '/') {
    filesDIR += "/";
  }
}

var numDaysInBucket = 10;
if (process.argv[3] != undefined) {
  numDaysInBucket = +process.argv[3];
}

function createIndents() {
  var output = utils.readCSVFile(filesDIR + 'R1 - Indent Summary by Sub-bucket.csv', 7, true);
  var demand = utils.readCSVFile(filesDIR + 'S9 - Final Demand V2.csv', 7, true);
  var destCount = utils.readCSVFile(filesDIR + 'M10 - Transporter Priority Constraint.csv', 7, true);

  var ClubPlantDemand = {};
  for (var i = 1; i < demand.length; i++) {
    var currRow = demand[i];
    var clubPlant = currRow[0];
    var plant = currRow[1];
    var plantClusterTruckTypeKey = currRow[0] + ":::" + currRow[2] + ":::" + currRow[3] + ":::" + currRow[4];
    var destination = currRow[5];
    var demandValue = parseInt(currRow[6]);
    if (!ClubPlantDemand.hasOwnProperty(plantClusterTruckTypeKey)) {
      ClubPlantDemand[plantClusterTruckTypeKey] = {
        totalDemand: 0,
        totalSupply: 0,
        Parts: {},
        Plants: {}
      };
    }
    if (!ClubPlantDemand[plantClusterTruckTypeKey].Plants.hasOwnProperty(plant)) {
      ClubPlantDemand[plantClusterTruckTypeKey].Plants[plant] = {
        demand: 0,
        perc: 0
      };
    }
    ClubPlantDemand[plantClusterTruckTypeKey].totalDemand += demandValue;
    ClubPlantDemand[plantClusterTruckTypeKey].Plants[plant].demand += demandValue;
  }

  var outputPlantClusterTruckType = {};
  for (var i = 1; i < output.length; i++) {
    var currRow = output[i];
    var plantClusterTruckTypeKey = currRow[0] + ":::" + currRow[1] + ":::" + currRow[2] + ":::" + currRow[4];
    var plantName = currRow[0];
    var operatorKey = currRow[3];
    var part = currRow[5];
    var supply = parseInt(currRow[6]);

    if (!ClubPlantDemand.hasOwnProperty(plantClusterTruckTypeKey)) {
      ClubPlantDemand[plantClusterTruckTypeKey] = {
        Parts: {},
        Plants: {}
      };
    }
    if (!ClubPlantDemand[plantClusterTruckTypeKey].Parts.hasOwnProperty(part)) {
      ClubPlantDemand[plantClusterTruckTypeKey].Parts[part] = {
        supply: 0,
        perc: 0
      };
    }
    ClubPlantDemand[plantClusterTruckTypeKey].totalSupply += supply;
    ClubPlantDemand[plantClusterTruckTypeKey].Parts[part].supply += supply;

    if (!outputPlantClusterTruckType.hasOwnProperty(plantClusterTruckTypeKey)) {
      outputPlantClusterTruckType[plantClusterTruckTypeKey] = {};
    }
    if (!outputPlantClusterTruckType[plantClusterTruckTypeKey].hasOwnProperty(operatorKey)) {
      outputPlantClusterTruckType[plantClusterTruckTypeKey][operatorKey] = [];
    }
    outputPlantClusterTruckType[plantClusterTruckTypeKey][operatorKey].push({
      part: part,
      supply: supply
    });
  }

  var ClubPlantKeys = Object.keys(ClubPlantDemand);
  ClubPlantKeys.forEach(function(ClubPlantKey) {
    var PartKeys = Object.keys(ClubPlantDemand[ClubPlantKey].Parts);
    PartKeys.forEach(function(PartKey) {
      ClubPlantDemand[ClubPlantKey].Parts[PartKey].perc = ClubPlantDemand[ClubPlantKey].Parts[PartKey].supply / ClubPlantDemand[ClubPlantKey].totalSupply;
    });
    var PlantKeys = Object.keys(ClubPlantDemand[ClubPlantKey].Plants);
    PlantKeys.forEach(function(PlantKey) {
      Object.keys(ClubPlantDemand[ClubPlantKey].Plants[PlantKey]);
      ClubPlantDemand[ClubPlantKey].Plants[PlantKey].Parts = {};
      PartKeys.forEach(function(PartKey) {
        ClubPlantDemand[ClubPlantKey].Plants[PlantKey].Parts[PartKey] = Math.ceil(ClubPlantDemand[ClubPlantKey].Parts[PartKey].perc * ClubPlantDemand[ClubPlantKey].Plants[PlantKey].demand);
      });
    });
  });
  // debug(ClubPlantDemand['1150/1180']);
  // debug(ClubPlantDemand['1150/1180'].Plants['1150']);
  // debug(ClubPlantDemand['1150/1180'].Plants['1180']);
  // process.exit(0);

  var destCountClusterTruckType = {};
  for (var i = 1; i < destCount.length; i++) {
    var currRow = destCount[i];
    var clusterTruckTypeKey = currRow[0] + ":::" + currRow[1] + ":::" + currRow[2] + ":::" + currRow[5];
    var operatorKey = currRow[4];
    var destination = currRow[3];
    var count = currRow[6];

    if (!destCountClusterTruckType.hasOwnProperty(clusterTruckTypeKey)) {
      destCountClusterTruckType[clusterTruckTypeKey] = {};
    }
    if (!destCountClusterTruckType[clusterTruckTypeKey].hasOwnProperty(destination)) {
      destCountClusterTruckType[clusterTruckTypeKey][destination] = {};
    }
    if (!destCountClusterTruckType[clusterTruckTypeKey][destination].hasOwnProperty(operatorKey)) {
      destCountClusterTruckType[clusterTruckTypeKey][destination][operatorKey] = count;
    } else {
      throw Error("Same combination came more than once time", clusterTruckTypeKey, destination, operatorKey);
    }
  }
  // debug(destCountClusterTruckType);

  function selectOperatorForDestination(clusterTruckTypeKey, destination, operators) {
    if (!destCountClusterTruckType.hasOwnProperty(clusterTruckTypeKey)) {
      destCountClusterTruckType[clusterTruckTypeKey] = {};
    }
    if (!destCountClusterTruckType[clusterTruckTypeKey].hasOwnProperty(destination)) {
      destCountClusterTruckType[clusterTruckTypeKey][destination] = {};
    }
    operators.forEach(function(operator) {
      if (!destCountClusterTruckType[clusterTruckTypeKey][destination].hasOwnProperty(operator)) {
        destCountClusterTruckType[clusterTruckTypeKey][destination][operator] = 0;
      }
    });

    operators.sort(function(operator1, operator2) {
      var currValue1 = destCountClusterTruckType[clusterTruckTypeKey][destination][operator1];
      var currValue2 = destCountClusterTruckType[clusterTruckTypeKey][destination][operator2];
      return currValue1 - currValue2;
    });
    return operators;
  }

  var indents = [];

  function insertIndents(plant, clusterTruckTypeKey, destination, operator, part, trucks) {
    var keys = clusterTruckTypeKey.split(":::");
    // if(ClubPlantDemand[keys[0]].Plants[plant].Parts[part] > 0){
    //   ClubPlantDemand[keys[0]].Plants[plant].Parts[part]--;
    // }
    // else {
    //   debug("Split is not correct : ",part, ClubPlantDemand[keys[0]].Plants[plant].Parts);
    //   throw Error("Split is not correct");
    // }
    for (var i = 0; i < trucks; i++) {
      indents.push({
        Plant: plant,
        ClubPlants: keys[0],
        Cluster: keys[1],
        SubCLuster: keys[2],
        TruckType: keys[3],
        Destination: destination,
        operator: operator,
        Part: part
      });
    }
  }


  while (true) {
    if (demand.length === 1)
      break;
    for (var i = 1; i < demand.length; i++) {
      var continueWhile = false;
      var currRow = demand[i];
      var clubPlant = currRow[0];
      var plant = currRow[1];
      var plantClusterTruckTypeKey = currRow[0] + ":::" + currRow[2] + ":::" + currRow[3] + ":::" + currRow[4];
      var destination = currRow[5];
      var demandValue = parseInt(currRow[6]);
      if (demandValue <= 0) {
        demand.splice(i, 1);
        i--;
        continue;
      }
      if (outputPlantClusterTruckType.hasOwnProperty(plantClusterTruckTypeKey)) {
        if (demandValue > 0 && continueWhile === false) {
          // if(plant==="1150")
          // debug({
          //   row: i,
          //   plantClusterTruckTypeKey: plantClusterTruckTypeKey,
          //   destination: destination,
          //   demand: demandValue
          // });
          var destCountClusterTruckTypeResult = destCountClusterTruckType[plantClusterTruckTypeKey];
          var outputClusterTruckTypeResult = outputPlantClusterTruckType[plantClusterTruckTypeKey];
          var operators = Object.keys(outputClusterTruckTypeResult);
          if (operators.length === 0) {
            debug(outputClusterTruckTypeResult, demandValue);
            throw Error("No operators");
          }
          operators = selectOperatorForDestination(plantClusterTruckTypeKey, destination, operators);
          var found = false;
          for (var SGIndex = 0; SGIndex < 2 && demandValue > 0; SGIndex++) {
            for (var operatorIndex = 0; operatorIndex < operators.length; operatorIndex++) {
              var selectedOperator = operators[operatorIndex];
              // if(plant==="1150")
              // debug("Selected Operator", selectedOperator, "for index ", i, demandValue);
              if (outputClusterTruckTypeResult[selectedOperator] == undefined || outputClusterTruckTypeResult[selectedOperator][SGIndex] == undefined) {
                continue;
              }
              var SGRow = outputClusterTruckTypeResult[selectedOperator][SGIndex];
              if (SGRow.supply > 0) {
                // if(plant==="1150")
                // debug({type:"demandValue >= SGRow.supply",operator: selectedOperator, part: SGRow.part, Supply:SGRow.supply, demand:1});
                if (ClubPlantDemand[plantClusterTruckTypeKey].Plants[plant].Parts[SGRow.part] > 0) {
                  // debug(i, plantClusterTruckTypeKey, plant, destination, SGRow.part, currRow[6]);
                  destCountClusterTruckType[plantClusterTruckTypeKey][destination][selectedOperator] += 1;
                  ClubPlantDemand[plantClusterTruckTypeKey].Plants[plant].Parts[SGRow.part] -= 1;
                  ClubPlantDemand[plantClusterTruckTypeKey].Plants[plant].demand -= 1;
                  insertIndents(plant, plantClusterTruckTypeKey, destination, selectedOperator, SGRow.part, 1);
                  SGRow.supply -= 1;
                  demandValue -= 1;
                  currRow[6] = parseInt(currRow[6]) - 1;
                  found = true;
                  continueWhile = true;
                  // if (SGRow.supply === 0) {
                  // outputClusterTruckTypeResult[selectedOperator].splice(SGIndex, 1);
                  // SGIndex--;
                  // }
                  break;
                }
              } else {
                // outputClusterTruckTypeResult[selectedOperator].splice(SGIndex, 1);
                // SGIndex--;
              }
              if (outputClusterTruckTypeResult[selectedOperator].length === 0) {
                delete outputClusterTruckTypeResult[selectedOperator];
              }
            }
            if (Object.keys(outputPlantClusterTruckType[plantClusterTruckTypeKey]).length === 0) {
              delete outputPlantClusterTruckType[plantClusterTruckTypeKey];
            }
          }
          if (found === false) {
            // debug(ClubPlantDemand['1150/1180']);
            // debug(ClubPlantDemand['1150/1180'].Plants['1150']);
            // debug(ClubPlantDemand['1150/1180'].Plants['1180']);
            debug(ClubPlantDemand[plantClusterTruckTypeKey].Plants['1150'], ClubPlantDemand[plantClusterTruckTypeKey].Plants['1180']);
            debug(i, " out of ", demand.length, currRow);
            // writeIndents();
            throw Error("Issue with operator selection");
            // break;
          }
        }
      } else {
        debug("Unknown clusterTruckTypeKey : " + clusterTruckTypeKey);
        demand.splice(i, 1);
        i--;
        continue;
        // throw Error("Unknown clusterTruckTypeKey : "+ clusterTruckTypeKey);
      }
      // debug("Loop", i);
    }
  }

  function prepareDates(SGDates, distributionType, cb) {
    debug(SGDates);
    var SG1Dates = [];
    var SG2Dates = [];
    var numDaysInCurrBucket = SGDates.length;
    var SG1DatesLength = Math.ceil(numDaysInCurrBucket / 2);
    var SG2DatesLength = numDaysInCurrBucket - SG1DatesLength;
    if (distributionType === "sequance") {
      for (var i = 0; i < SG1DatesLength; i++) {
        SG1Dates.push(SGDates[i]);
      }
      for (var i = SG1DatesLength; i < numDaysInCurrBucket; i++) {
        SG2Dates.push(SGDates[i]);
      }
      cb(SG1Dates, SG2Dates);
      return;
    } else if (distributionType === "distribution") {
      if (SG1DatesLength % 2 === 0) {
        utils.evenDistributionRange({
          input: [{
            start: 1,
            end: SG1DatesLength + 1
          }],
          output: []
        }, false, function(output) {
          output.output.unshift(1);
          debug("SG1DatesLength % 2 === 0", output.output);
          applySGDates(output, SG1Dates);
        });
      } else {
        utils.evenDistributionRange({
          input: [{
            start: 1,
            end: SG1DatesLength
          }],
          output: []
        }, true, function(output) {
          debug("SG1DatesLength % 2 !== 0", output.output);
          applySGDates(output, SG1Dates);
        });
      }

      if (SG2DatesLength % 2 === 0) {
        utils.evenDistributionRange({
          input: [{
            start: SG1DatesLength + 1,
            end: numDaysInCurrBucket + 1
          }],
          output: []
        }, false, function(output) {
          output.output.unshift(SG1DatesLength + 1);
          debug("SG2DatesLength % 2 === 0", output.output);
          applySGDates(output, SG2Dates);
        });
      } else {
        utils.evenDistributionRange({
          input: [{
            start: SG1DatesLength + 1,
            end: numDaysInCurrBucket
          }],
          output: []
        }, true, function(output) {
          debug("SG2DatesLength % 2 !== 0", output.output);
          applySGDates(output, SG2Dates);
        });
      }
    }

    function applySGDates(output, SGDatesLocal) {
      debug("applySGDates", output.output)
      output.output.forEach(function(index) {
        SGDatesLocal.push(SGDates[index - 1]);
      });

      if (SG1Dates.length > 0 && SG2Dates.length > 0) {
        cb(SG1Dates, SG2Dates);
      }
    }

    // if (numDaysInBucket === 8) {
    //   SG1Dates = [1, 3, 2, 4];
    //   SG2Dates = [5, 7, 6, 8];
    // } else if (numDaysInBucket === 9) {
    //   SG1Dates = [1, 3, 5, 2, 4];
    //   SG2Dates = [6, 8, 7, 9];
    // } else if (numDaysInBucket === 10) {
    //   SG1Dates = [1, 3, 5, 2, 4];
    //   SG2Dates = [6, 8, 10, 7, 9];
    // } else {
    //   SG1Dates = [1, 3, 5, 2, 4, 6];
    //   SG2Dates = [7, 9, 11, 8, 10];
    // }
  }

  function writeIndents() {
    var destinationCount = {};
    indents.forEach(function(d) {
      var key = d.Plant + ":::" + d.Cluster + ":::" + d.SubCLuster + ":::" + d.TruckType + ":::" + d.Destination;
      if (!destinationCount.hasOwnProperty(key)) {
        destinationCount[key] = 0;
      } else {
        destinationCount[key]++;
      }
      d["sortIndex"] = destinationCount[key];
    });
    indents = indents.sort(function(a, b) {
      return a.sortIndex - b.sortIndex;
      // if (a.sortIndex < b.sortIndex)
      //   return -1;
      // if (a.sortIndex > b.sortIndex)
      //   return 1;
      // return 0;
    });
    var SGDates = [];
    for (var dIndex = 0; dIndex < numDaysInBucket; dIndex++) {
      SGDates.push(dIndex + 1);
    }
    prepareDates(SGDates, "sequance", function(SG1Dates, SG2Dates) {
      // var SG1Dates = [];
      // var SG2Dates = [];
      // if (numDaysInBucket === 8) {
      //   SG1Dates = [1, 3, 2, 4];
      //   SG2Dates = [5, 7, 6, 8];
      // } else if (numDaysInBucket === 9) {
      //   SG1Dates = [1, 3, 5, 2, 4];
      //   SG2Dates = [6, 8, 7, 9];
      // } else if (numDaysInBucket === 10) {
      //   SG1Dates = [1, 3, 5, 2, 4];
      //   SG2Dates = [6, 8, 10, 7, 9];
      // } else {
      //   SG1Dates = [1, 3, 5, 2, 4, 6];
      //   SG2Dates = [7, 9, 11, 8, 10];
      // }

      var destinationCounter = {};
      var operatorCounter = {};

      function getDateCounter() {
        var Parts = {
          SG1: [],
          SG2: []
        };
        for (var i = 0; i < SG1Dates.length; i++) {
          Parts.SG1[i] = {
            key: SG1Dates[i],
            counter: 0,
            index: i
          };
        }
        for (var i = 0; i < SG2Dates.length; i++) {
          Parts.SG2[i] = {
            key: SG2Dates[i],
            counter: 0,
            index: i
          };
        }
        return Parts;
      }

      function findDateFor(destination, operator, part) {
        if (!destinationCounter.hasOwnProperty(destination)) {
          destinationCounter[destination] = getDateCounter();
        }
        if (!operatorCounter.hasOwnProperty(operator)) {
          operatorCounter[operator] = getDateCounter();
        }
        var availableDays = [];
        if (part == "SG1")
          availableDays = SG1Dates;
        else
          availableDays = SG2Dates;
        var desinations = destinationCounter[destination][part].filter(function(d) {
          return availableDays.indexOf(d.key) !== -1;
        });
        var minSelection = [{
          key: desinations[0].key,
          index: desinations[0].index
        }];
        var minCounter = desinations[0].counter;
        for (var i = 1; i < desinations.length; i++) {
          if (minCounter > desinations[i].counter) {
            minSelection = [{
              key: desinations[i].key,
              index: desinations[i].index
            }];
            minCounter = desinations[i].counter;
          } else if (minCounter === desinations[i].counter) {
            minSelection.push({
              key: desinations[i].key,
              index: desinations[i].index
            });
          }
        }

        // debug(operatorCounter, operator, part, minSelection);
        availableDays = minSelection.map(function(d) {
          return d.key;
        });
        var operators = operatorCounter[operator][part].filter(function(d) {
          return availableDays.indexOf(d.key) !== -1;
        });
        minSelection = [{
          key: operators[0].key,
          index: operators[0].index
        }];
        minCounter = operators[0].counter;
        for (var i = 1; i < operators.length; i++) {
          if (minCounter > operators[i].counter) {
            minSelection = [{
              key: operators[i].key,
              index: operators[i].index
            }];
            minCounter = operators[i].counter;
          } else if (minCounter === operators[i].counter) {
            minSelection.push({
              key: operators[i].key,
              index: operators[i].index
            });
          }
        }
        destinationCounter[destination][part][minSelection[0].index].counter++;
        operatorCounter[operator][part][minSelection[0].index].counter++;
        return minSelection[0].key;
      }

      for (var i = 0; i < indents.length; i++) {
        indents[i].Date = findDateFor(indents[i].Destination, indents[i].operator, indents[i].Part);
        delete indents[i].sortIndex;
      }
      fs.writeFileSync(filesDIR + "O1 - Final Indents.csv", utils.JSON2CSV(indents, true));
      debug("Done.");
      // debug(JSON.stringify(outputPlantClusterTruckType));
      process.exit(0);
    });
  }
  writeIndents();
}


// process.on("message", function(m){
//     console.log(m);
//     if(m.type === "START_PROCESS"){
//         createIndents();
//     }
//     else if(m.type === "KILL"){
//         process.exit(0);
//     }
// });
createIndents();
