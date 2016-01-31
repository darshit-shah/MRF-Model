// solve http://people.brunel.ac.uk/~mastjjb/jeb/or/morelp.html

var fs = require('fs');
var lpsolve = require('lp_solve');

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
          if (convertUpper != false) {
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

//console.log(process.argv)
var filesDIR = "";
if (process.argv.length === 3) {
  filesDIR = process.argv[2];
  if (filesDIR[filesDIR.length - 1] !== '/') {
    filesDIR += "/";
  }
}

function runModel() {
  var demand = utils.readCSVFile(filesDIR + 'S8 - Model Demand Input.csv', 5, true);
  var supply = utils.readCSVFile(filesDIR + 'M6 - Transporter Supply Commitment.csv', 10, true);

  var Row = lpsolve.Row;

  var objective = new Row();
  var lp = new lpsolve.LinearProgram();

  //ClusterWise-Demand
  var demandKeys = [];
  var demandValues = [];
  for (var dIndex = 1; dIndex < demand.length; dIndex++) {
    var plant = demand[dIndex][0];
    var demandValue = parseInt(demand[dIndex][4]);
    var cluster = demand[dIndex][1];
    var subCluster = demand[dIndex][2];
    var truckType = demand[dIndex][3];
    if (demandValue > 0) {
      var localDemandKey = plant + ":::" + cluster + ":::" + subCluster + ":::" + truckType;
      var localIndex = demandKeys.indexOf(localDemandKey);
      if (localIndex == -1) {
        demandKeys.push(localDemandKey);
        demandValues.push({
          key: demandKeys[demandKeys.length - 1],
          demand: demandValue,
          decisionVariablesSG1: [],
          decisionVariablesSG2: []
        });
      } else {
        // demandValues[localIndex].demand += demandValue;
        throw Error("Duplicate demand came" + localDemandKey);
      }
    }
  }

  // //ClusterWise-Part1Wise-Demand
  // var demandMGKeys=[];
  // var demandMGValues=[];
  // for (var dIndex = 1; dIndex < demand.length; dIndex++) {
  //     demandMGKeys.push(demand[dIndex][1]+":::"+demand[dIndex][2]);
  //     demandMGValues.push({ key: demandMGKeys[demandMGKeys.length-1], demand: parseInt(demand[dIndex][3]), decisionVariables: [] });
  // }

  var decisionVariables = [];

  var operatorKeys = [];
  var operatorValues = [];
  for (var i = 1; i < supply.length; i++) {
    var supplyValue = parseInt(supply[i][8]);
    var usedTillNowCount = parseInt(supply[i][9]);
    var plant = supply[i][0];
    var cluster = supply[i][1];
    var subcluster = supply[i][2];
    var truckType = supply[i][3];
    var operatorName = supply[i][4]
    if (supplyValue > 0) {
      var localDemandKey = plant + ":::" + cluster + ":::" + subcluster + ":::" + truckType;
      var demandIndex = demandKeys.indexOf(localDemandKey);
      if (demandIndex != -1) {
        var operatorKey = plant + ":::" + cluster + ":::" + subcluster + ":::" + operatorName + ":::" + truckType;
        var operatorIndex = operatorKeys.indexOf(operatorKey);
        if (operatorIndex == -1) {
          operatorKeys.push(operatorKey);
          operatorValues.push({
            key: operatorKeys[operatorKeys.length - 1],
            supply: supplyValue,
            decisionVariablesSG1: [],
            decisionVariablesSG2: [],
            count: usedTillNowCount
          });
          operatorIndex = operatorKeys.length - 1;
        }
        // for (var iMG = 1; iMG < 2; iMG++) {
        //     var demandMGIndex = demandMGKeys.indexOf(supply[i][1]+":::MG"+iMG);
        //     if(demandMGIndex == -1){
        //         demandMGKeys.push(supply[i][1]+":::MG"+iMG);
        //         demandMGValues.push({ key: demandMGKeys[demandMGKeys.length-1], demand: 0, decisionVariables: [] });
        //         demandMGIndex = demandMGKeys.length-1;
        //     }
        for (var iSG = 1; iSG < 3; iSG++) {
          var variableName = plant + ":::" + cluster + ":::" + subcluster + ":::" + operatorName + ":::" + truckType + ":::SG" + iSG; //C1_O1_MG1_SG1
          var decisionVariable = lp.addColumn(variableName, true);
          objective = objective.Add(decisionVariable, usedTillNowCount);
          decisionVariables.push({
            key: variableName,
            value: decisionVariable
          });

          demandValues[demandIndex]["decisionVariablesSG" + iSG].push(decisionVariable);
          operatorValues[operatorIndex]["decisionVariablesSG" + iSG].push(decisionVariable);
        }
        // }
      }
    }
  }

  // for (var dIndex = 0; dIndex < demandMGValues.length; dIndex++) {
  //     console.log(demandKeys, demandMGValues[dIndex].key)
  //     var cIndex = demandKeys.indexOf(demandMGValues[dIndex].key.split(":::")[0]);
  //     demandMGValues[dIndex].demandPerc = (1.0 * demandMGValues[dIndex].demand) / demandValues[cIndex].demand;
  // }

  var demandConstraint = [];
  var demandConstraintSG1 = [];
  var demandConstraintSG2 = [];
  for (var dIndex = 0; dIndex < demandKeys.length; dIndex++) {
    // if (demandValues[dIndex].demand > 0 && demandValues[dIndex].decisionVariablesSG1.length + demandValues[dIndex].decisionVariablesSG2.length > 0) {
      demandConstraint.push(new Row());
      demandConstraintSG1.push(new Row());
      demandConstraintSG2.push(new Row());
      var found = false;
      for (var j = 0; j < demandValues[dIndex].decisionVariablesSG1.length; j++) {
        demandConstraint[dIndex] = demandConstraint[dIndex].Add(demandValues[dIndex].decisionVariablesSG1[j], 1);
        demandConstraintSG1[dIndex] = demandConstraintSG1[dIndex].Add(demandValues[dIndex].decisionVariablesSG1[j], 1);
        found = true;
      }
      for (var j = 0; j < demandValues[dIndex].decisionVariablesSG2.length; j++) {
        demandConstraint[dIndex] = demandConstraint[dIndex].Add(demandValues[dIndex].decisionVariablesSG2[j], 1);
        demandConstraintSG2[dIndex] = demandConstraintSG2[dIndex].Add(demandValues[dIndex].decisionVariablesSG2[j], 1);
        found = true;
      }
      if (found === true) {
        lp.addConstraint(demandConstraint[dIndex], 'EQ', demandValues[dIndex].demand, 'demand (' + demandValues[dIndex].key + ')');
        var SG1Demand = demandValues[dIndex].demand * 0.55;
        if (SG1Demand - parseInt(SG1Demand) === 0) {
          lp.addConstraint(demandConstraintSG1[dIndex], 'EQ', SG1Demand, 'demand SG1 (' + demandValues[dIndex].key + ')');
        } else {
          lp.addConstraint(demandConstraintSG1[dIndex], 'GE', Math.floor(SG1Demand), 'demand SG1 floor (' + demandValues[dIndex].key + ')');
          lp.addConstraint(demandConstraintSG1[dIndex], 'LE', Math.ceil(SG1Demand), 'demand SG1 Ceil(' + demandValues[dIndex].key + ')');
        }

        var SG2Demand = demandValues[dIndex].demand * 0.45;
        if (SG2Demand - parseInt(SG2Demand) === 0) {
          lp.addConstraint(demandConstraintSG2[dIndex], 'EQ', SG2Demand, 'demand SG2 (' + demandValues[dIndex].key + ')');
        } else {
          lp.addConstraint(demandConstraintSG2[dIndex], 'GE', Math.floor(SG2Demand), 'demand SG2 floor (' + demandValues[dIndex].key + ')');
          lp.addConstraint(demandConstraintSG2[dIndex], 'LE', Math.ceil(SG2Demand), 'demand SG2 Ceil(' + demandValues[dIndex].key + ')');
        }
      } else {
        lp.addConstraint(demandConstraint[dIndex], 'EQ', 0, 'demand (' + demandValues[dIndex].key + ')');
        lp.addConstraint(demandConstraintSG1[dIndex], 'EQ', 0, 'demand SG1 (' + demandValues[dIndex].key + ')');
        lp.addConstraint(demandConstraintSG2[dIndex], 'EQ', 0, 'demand SG2 (' + demandValues[dIndex].key + ')');
      }
    // }
    // else {
    //   demandConstraint.push(null);
    //   demandConstraintSG1.push(null);
    //   demandConstraintSG2.push(null);
    // }
  }

  var operatorConstraint = [];
  var operatorConstraintSG1 = [];
  var operatorConstraintSG2 = [];
  var operatorConstraintGT = [];
  for (var dIndex = 0; dIndex < operatorKeys.length; dIndex++) {
    // if (operatorValues[dIndex].supply > 0 && operatorValues[dIndex].decisionVariablesSG1.length + operatorValues[dIndex].decisionVariablesSG2.length > 0) {
      operatorConstraint.push(new Row());
      operatorConstraintSG1.push(new Row());
      operatorConstraintSG2.push(new Row());
      operatorConstraintGT.push(new Row());
      var value = operatorValues[dIndex].supply;
      var found = false;
      for (var j = 0; j < operatorValues[dIndex].decisionVariablesSG1.length; j++) {
        operatorConstraint[dIndex] = operatorConstraint[dIndex].Add(operatorValues[dIndex].decisionVariablesSG1[j], 1);
        // operatorConstraintGT[dIndex] = operatorConstraintGT[dIndex].Add(operatorValues[dIndex].decisionVariablesSG1[j], 1);
        operatorConstraintSG1[dIndex] = operatorConstraintSG1[dIndex].Add(operatorValues[dIndex].decisionVariablesSG1[j], 1);
        found = true;
      }
      for (var j = 0; j < operatorValues[dIndex].decisionVariablesSG2.length; j++) {
        operatorConstraint[dIndex] = operatorConstraint[dIndex].Add(operatorValues[dIndex].decisionVariablesSG2[j], 1);
        // operatorConstraintGT[dIndex] = operatorConstraintGT[dIndex].Add(operatorValues[dIndex].decisionVariablesSG2[j], -1);
        operatorConstraintSG2[dIndex] = operatorConstraintSG2[dIndex].Add(operatorValues[dIndex].decisionVariablesSG2[j], 1);
        found = true;
      }
      if (found === true) {
        // lp.addConstraint(operatorConstraintGT[dIndex], 'GE', 0, 'supply GT(' + operatorValues[dIndex].key + ')');
        lp.addConstraint(operatorConstraint[dIndex], 'GE', operatorValues[dIndex].supply - 1, 'supply (' + operatorValues[dIndex].key + ')');
        lp.addConstraint(operatorConstraint[dIndex], 'LE', operatorValues[dIndex].supply, 'supply (' + operatorValues[dIndex].key + ')');

        var SG1Supply = operatorValues[dIndex].supply * 0.55;
        lp.addConstraint(operatorConstraintSG1[dIndex], 'GE', Math.floor(SG1Supply), 'supply SG1 floor (' + operatorValues[dIndex].key + ')');
        lp.addConstraint(operatorConstraintSG1[dIndex], 'LE', Math.ceil(SG1Supply), 'supply SG1 Ceil(' + operatorValues[dIndex].key + ')');
        //
        var SG2Supply = operatorValues[dIndex].supply * 0.45;
        lp.addConstraint(operatorConstraintSG2[dIndex], 'GE', Math.floor(SG2Supply), 'supply SG2 floor (' + operatorValues[dIndex].key + ')');
        lp.addConstraint(operatorConstraintSG2[dIndex], 'LE', Math.ceil(SG2Supply), 'supply SG2 Ceil(' + operatorValues[dIndex].key + ')');
      } else {
        // lp.addConstraint(operatorConstraintGT[dIndex], 'EQ', 0, 'supply GT(' + operatorValues[dIndex].key + ')');
        lp.addConstraint(operatorConstraint[dIndex], 'EQ', 0, 'supply (' + operatorValues[dIndex].key + ')');
        lp.addConstraint(operatorConstraintSG1[dIndex], 'EQ', 0, 'supply SG1(' + operatorValues[dIndex].key + ')');
        lp.addConstraint(operatorConstraintSG2[dIndex], 'EQ', 0, 'supply SG2(' + operatorValues[dIndex].key + ')');
      }
    // }
  }
  // }
  // var SGValue = value * 0.55;
  // if (SGValue === parseInt(SGValue)) {
  //   SGValue -= 0.00001;
  // }
  // console.log(operatorValues[dIndex].decisionVariables[j], value, value * 0.1);
  // totalDiff += value * 0.1;
  // var SGConstraint = new Row();
  // SGConstraint = SGConstraint.Add(operatorValues[dIndex].decisionVariables[j], 1);
  //
  // lp.addConstraint(SGConstraint, 'GE', Math.floor(SGValue), 'MG (' + operatorValues[dIndex].key + ')');
  // lp.addConstraint(SGConstraint, 'LE', Math.ceil(SGValue), 'MG (' + operatorValues[dIndex].key + ')');
  //
  // if (operatorValues[dIndex].decisionVariables[j].indexOf(":::SG1") > -1) {
  //   // objective = objective.Add(operatorValues[dIndex].decisionVariables[j], 1);
  //   innerConstraints = innerConstraints.Add(operatorValues[dIndex].decisionVariables[j], -1);
  //   innerConstraintsAdded = true;
  // } else if (operatorValues[dIndex].decisionVariables[j].indexOf(":::SG2") > -1) {
  //   // objective = objective.Add(operatorValues[dIndex].decisionVariables[j], -1);
  //   innerConstraints = innerConstraints.Add(operatorValues[dIndex].decisionVariables[j], 1);
  //   innerConstraintsAdded = true;
  // }
  // if (innerConstraintsAdded == true) {
  //   lp.addConstraint(innerConstraints, 'LE', 0, 'SG (' + operatorValues[dIndex].key + ')');
  // }
  // lp.addConstraint(operatorConstraint[dIndex], 'GE', operatorValues[dIndex].supply - 1, 'supply (' + operatorValues[dIndex].key + ')');
  // lp.addConstraint(operatorConstraint[dIndex], 'LE', operatorValues[dIndex].supply, 'supply (' + operatorValues[dIndex].key + ')');
  // else {
  //   lp.addConstraint(operatorConstraint[dIndex], 'EQ', 0, 'supply (' + operatorValues[dIndex].key + ')');
  // }

  // console.log(totalDiff / 2, totalDemand / 10);
  // lp.addConstraint(objective, 'GE', totalDemand / 10, 'demand cap');

  // console.log(objective);
  lp.setObjective(objective);
  // console.log(lp.dumpProgram());
  var modelResult = lp.solve();
  console.log(modelResult);
  console.log('objective =', lp.getObjectiveValue());

  if (modelResult.code === 0) {
    var rows = [];
    rows.push("Plant,Cluster,SubCluster,Operator,TruckType,Part2,Allocation");
    for (var dIndex = 0; dIndex < decisionVariables.length; dIndex++) {
      // console.log(decisionVariables[dIndex].key,' =', lp.get(decisionVariables[dIndex].key));
      var keys = decisionVariables[dIndex].key.split(":::");
      var outputValue = lp.get(decisionVariables[dIndex].key);
      if (outputValue > 0) {
        keys.push(lp.get(decisionVariables[dIndex].key));
        rows.push(keys.join());
      }
    }
    fs.writeFileSync(filesDIR + "R1 - Indent Summary by Sub-bucket.csv", rows.join("\n"));
  }
  process.exit(0);
}
runModel();
