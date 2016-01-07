var fs = require('fs');
var debug = require('debug')('model:model');
var utils = {
  readCSVFile: function(path, fieldsLength, convertUpper) {
    var data = fs.readFileSync(path);
    var rows = data.toString().split("\n");
    for (var rIndex = 0; rIndex < rows.length; rIndex++) {
      if (rows[rIndex].length > 0) {
        rows[rIndex] = rows[rIndex].split(",");
        if (rows[rIndex].length != fieldsLength) {
          throw Error(fieldsLength, " fields required. Found: ", rows[rIndex].length, "Data: ", rows[rIndex]);
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
      if (includeHeader != false) {
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
}

var filesDIR = "";
if (process.argv.length === 3) {
  filesDIR = process.argv[2];
  if (filesDIR[filesDIR.length - 1] !== '/') {
    filesDIR += "/";
  }
}

function createIndents() {
  var output = utils.readCSVFile(filesDIR + 'output.csv', 7, true);
  var demand = utils.readCSVFile(filesDIR + 'Step11_Demand_Destination_Wise.csv', 7, true);
  var destCount = utils.readCSVFile(filesDIR + 'IndentCountConstraint.csv', 7, true);

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

    // debug("Sorting", destCountClusterTruckType[clusterTruckTypeKey][destination]);
    // operators = Object.keys(destCountClusterTruckType[clusterTruckTypeKey][destination]);
    // var selectedOperator = null;
    // var minValue = +Infinity;
    // operators.every(function(operator) {
    //   var currValue = destCountClusterTruckType[clusterTruckTypeKey][destination][operator];
    //   if (currValue < minValue) {
    //     minValue = currValue;
    //     selectedOperator = operator;
    //   }
    //   if (currValue == 0) {
    //     return false;
    //   }
    //   return true;
    // });
    // if (selectedOperator == null) {
    //   debug(operators);
    //   throw Error("selectedOperator is null from given operators" + operators);
    // }
    // return selectedOperator;
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
  for (var i = 1; i < demand.length; i++) {
    var currRow = demand[i];
    var clubPlant = currRow[0];
    var plant = currRow[1];
    var plantClusterTruckTypeKey = currRow[0] + ":::" + currRow[2] + ":::" + currRow[3] + ":::" + currRow[4];
    var destination = currRow[5];
    var demandValue = parseInt(currRow[6]);
    if (outputPlantClusterTruckType.hasOwnProperty(plantClusterTruckTypeKey)) {
      while (demandValue > 0) {
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
          debug(clusterTruckTypeKey, demandValue);
          throw Error("No operators");
        }
        operators = selectOperatorForDestination(plantClusterTruckTypeKey, destination, operators);
        var found = false;
        for (var operatorIndex = 0; operatorIndex < operators.length && found === false; operatorIndex++) {
          var selectedOperator = operators[operatorIndex];
          // debug("Selected Operator", selectedOperator, "for index ", i, demandValue);
          for (var SGIndex = 0; SGIndex < outputClusterTruckTypeResult[selectedOperator].length && found === false && demandValue > 0; SGIndex++) {
            var SGRow = outputClusterTruckTypeResult[selectedOperator][SGIndex];
            if (SGRow.supply > 0) {
              // debug({type:"demandValue >= SGRow.supply",operator: selectedOperator, part: SGRow.part, Supply:SGRow.supply, demand:1});
              if (ClubPlantDemand[plantClusterTruckTypeKey].Plants[plant].Parts[SGRow.part] > 0) {
                destCountClusterTruckType[plantClusterTruckTypeKey][destination][selectedOperator] += 1;
                ClubPlantDemand[plantClusterTruckTypeKey].Plants[plant].Parts[SGRow.part] -= 1;
                ClubPlantDemand[plantClusterTruckTypeKey].Plants[plant].demand -= 1;
                insertIndents(plant, plantClusterTruckTypeKey, destination, selectedOperator, SGRow.part, 1);
                SGRow.supply -= 1;
                demandValue -= 1;
                found = true;
                if (SGRow.supply == 0){
                  outputClusterTruckTypeResult[selectedOperator].splice(SGIndex, 1);
                  SGIndex--;
                }
              }
            } else {
              outputClusterTruckTypeResult[selectedOperator].splice(SGIndex, 1);
              SGIndex--;
            }
          }
          if (outputClusterTruckTypeResult[selectedOperator].length === 0) {
            delete outputClusterTruckTypeResult[selectedOperator];
          }
          if(Object.keys(outputPlantClusterTruckType[plantClusterTruckTypeKey]).length === 0){
            delete outputPlantClusterTruckType[plantClusterTruckTypeKey];
          }
          // break;
        }
        if (found === false) {
          // debug(ClubPlantDemand['1150/1180']);
          // debug(ClubPlantDemand['1150/1180'].Plants['1150']);
          // debug(ClubPlantDemand['1150/1180'].Plants['1180']);
          debug(i, currRow);
          // writeIndents();
          throw Error("Issue with operator selection");
          // break;
        }
      }
    } else {
      //throw Error("Unknown clusterTruckTypeKey : "+ clusterTruckTypeKey);
    }
    // debug("Loop", i);
  }

  function writeIndents() {
    indents = indents.sort(function(a, b) {
      if (a.operator < b.operator)
        return -1;
      if (a.operator > b.operator)
        return 1;
      return 0;
    });
    var Parts = {
      "SG1": {
        counter: 0,
        Dates: [1, 3, 5, 2, 4]
      },
      "SG2": {
        counter: 0,
        Dates: [6, 8, 10, 7, 9]
      }
    }

    for (var i = 0; i < indents.length; i++) {
      // debug(indents[i]);
      var dateIndex = Parts[indents[i].Part].counter % Parts[indents[i].Part].Dates.length;
      // debug(Parts[indents[i].part].counter, Parts[indents[i].part].Dates.length, dateIndex, Parts[indents[i].part].Dates[dateIndex]);
      //indents.push({Cluster:keys[0], TruckType:keys[1], Destination:destination, operator:operator, Part:part});
      indents[i].Date = Parts[indents[i].Part].Dates[dateIndex]
      Parts[indents[i].Part].counter++;
    }
    fs.writeFileSync(filesDIR + "indents.csv", utils.JSON2CSV(indents, true));
    debug("Done.");
    // debug(ClubPlantDemand['1150/1180']);
    // debug(ClubPlantDemand['1150/1180'].Plants['1150']);
    // debug(ClubPlantDemand['1150/1180'].Plants['1180']);
    debug(JSON.stringify(outputPlantClusterTruckType));
    process.exit(0);
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
