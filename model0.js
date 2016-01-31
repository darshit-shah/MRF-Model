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
  var demandMGKeys = [];
  var demandMGValues = [];
  var totalDemand = 0;
  var decisionVariables = [];
  var constraintVariables = [];
  var machineatime = new Row();
  for (var dIndex = 1; dIndex < demand.length; dIndex++) {
    var plant = demand[dIndex][0];
    var demandValue = parseInt(demand[dIndex][4]);
    var cluster = demand[dIndex][1];
    var subCluster = demand[dIndex][2];
    var truckType = demand[dIndex][3];

    if (demandValue > 0) {
      totalDemand += demandValue;
      var localDemandKey = plant + ":::" + cluster + ":::" + subCluster + ":::" + truckType + ":::" + dIndex;
      var localIndex = demandKeys.indexOf(localDemandKey);
      if (localIndex == -1) {
        localIndex = demandKeys.length;
        var decisionVariableSG1 = lp.addColumn(localDemandKey + ":::SG1", true);
        var decisionVariableSG2 = lp.addColumn(localDemandKey + ":::SG2", true);
        var decisionVariableSG1Surplus = lp.addColumn(localDemandKey + ":::SG1:::Surplus");
        var decisionVariableSG1Slack = lp.addColumn(localDemandKey + ":::SG1:::Slack");
        var decisionVariableSG2Surplus = lp.addColumn(localDemandKey + ":::SG2:::Surplus");
        var decisionVariableSG2Slack = lp.addColumn(localDemandKey + ":::SG2:::Slack");

        demandKeys.push(localDemandKey);
        demandValues.push({
          key: demandKeys[demandKeys.length - 1],
          demand: demandValue,
          decisionVariables: {
            key: localDemandKey,
            SG1: decisionVariableSG1,
            SG2: decisionVariableSG2,
            SG1Surplus: decisionVariableSG1Surplus,
            SG2Surplus: decisionVariableSG2Surplus,
            SG1Slack: decisionVariableSG1Slack,
            SG2Slack: decisionVariableSG2Slack
          }
        });

        // lp.addConstraint(new Row().Add(decisionVariables[localIndex].SG1, 1).Add(decisionVariables[localIndex].SG2, 1), 'EQ', demandValue, 'demand (' + localDemandKey + ')');
        // lp.addConstraint(new Row().Add(decisionVariableSG1,1).Add(decisionVariableSG1Surplus, 1).Add(decisionVariableSG1Slack, -1), 'EQ', demandValue*0.55, 'demand SG1(' + localDemandKey + ')');
        // lp.addConstraint(new Row().Add(decisionVariableSG2,1).Add(decisionVariableSG2Surplus, 1).Add(decisionVariableSG2Slack, -1), 'EQ', demandValue*0.45, 'demand SG2(' + localDemandKey + ')');
        // lp.addConstraint(new Row().Add(decisionVariableSG1Surplus,1),'GE', 0, 'Surplus SG1(' + localDemandKey + ')');
        // lp.addConstraint(new Row().Add(decisionVariableSG2Surplus,1),'GE', 0, 'Surplus SG2(' + localDemandKey + ')');
        // lp.addConstraint(new Row().Add(decisionVariableSG1Slack,1),'GE', 0, 'Slack SG1(' + localDemandKey + ')');
        // lp.addConstraint(new Row().Add(decisionVariableSG2Slack,1),'GE', 0, 'Slack SG2(' + localDemandKey + ')');
        // objective=objective.Add(decisionVariableSG1Surplus,1).Add(decisionVariableSG2Surplus,1).Add(decisionVariableSG1Slack,1).Add(decisionVariableSG2Slack,1);
      } else {
        throw Error("Duplicate demand came" + localDemandKey);
      }
    }
  }

  //ClusterWise-Part1Wise-Demand
  // var demandMGKeys=[];
  // var demandMGValues=[];
  // for (var dIndex = 1; dIndex < demand.length; dIndex++) {
  //     demandMGKeys.push(demand[dIndex][1]+":::"+demand[dIndex][2]);
  //     demandMGValues.push({ key: demandMGKeys[demandMGKeys.length-1], demand: parseInt(demand[dIndex][3]), decisionVariables: [] });
  // }


  //
  // var operatorKeys = [];
  // var operatorValues = [];
  // for (var i = 1; i < supply.length; i++) {
  //   var supplyValue = parseInt(supply[i][8]);
  //   var usedTillNowCount = parseInt(supply[i][9]);
  //   var plant = supply[i][0];
  //   var cluster = supply[i][1];
  //   var subcluster = supply[i][2];
  //   var truckType = supply[i][3];
  //   var operatorName = supply[i][4]
  //   if (supplyValue > 0) {
  //     var localDemandKey = plant + ":::" + cluster + ":::" + subcluster + ":::" + truckType;
  //     var demandIndex = demandKeys.indexOf(localDemandKey);
  //     if (demandIndex != -1) {
  //       var operatorKey = plant + ":::" + cluster + ":::" + subcluster + ":::" + operatorName + ":::" + truckType;
  //       var operatorIndex = operatorKeys.indexOf(operatorKey);
  //       if (operatorIndex == -1) {
  //         operatorKeys.push(operatorKey);
  //         operatorValues.push({
  //           key: operatorKeys[operatorKeys.length - 1],
  //           supply: supplyValue,
  //           decisionVariables: [],
  //           count: usedTillNowCount
  //         });
  //         operatorIndex = operatorKeys.length - 1;
  //       }
  //       for (var iSG = 1; iSG < 3; iSG++) {
  //         var variableName = plant + ":::" + cluster + ":::" + subcluster + ":::" + operatorName + ":::" + truckType + ":::SG" + iSG; //C1_O1_MG1_SG1
  //         var decisionVariable = lp.addColumn(variableName, true);
  //         objective = objective.Add(decisionVariable, usedTillNowCount);
  //         decisionVariables.push({
  //           key: variableName,
  //           value: decisionVariable
  //         });
  //
  //         demandValues[demandIndex].decisionVariables.push(decisionVariable);
  //         // demandMGValues[demandMGIndex].decisionVariables.push(decisionVariable);
  //         operatorValues[operatorIndex].decisionVariables.push(decisionVariable);
  //       }
  //       // }
  //     }
  //   }
  // }
  //
  // // for (var dIndex = 0; dIndex < demandMGValues.length; dIndex++) {
  // //     console.log(demandKeys, demandMGValues[dIndex].key)
  // //     var cIndex = demandKeys.indexOf(demandMGValues[dIndex].key.split(":::")[0]);
  // //     demandMGValues[dIndex].demandPerc = (1.0 * demandMGValues[dIndex].demand) / demandValues[cIndex].demand;
  // // }


  // lp.addConstraint(new Row().Add(decisionVariables[localIndex].SG1, 1).Add(decisionVariables[localIndex].SG2, 1), 'EQ', demandValue, 'demand (' + localDemandKey + ')');
  // lp.addConstraint(new Row().Add(decisionVariableSG1,1).Add(decisionVariableSG1Surplus, 1).Add(decisionVariableSG1Slack, -1), 'EQ', demandValue*0.55, 'demand SG1(' + localDemandKey + ')');
  // lp.addConstraint(new Row().Add(decisionVariableSG2,1).Add(decisionVariableSG2Surplus, 1).Add(decisionVariableSG2Slack, -1), 'EQ', demandValue*0.45, 'demand SG2(' + localDemandKey + ')');
  // lp.addConstraint(new Row().Add(decisionVariableSG1Surplus,1),'GE', 0, 'Surplus SG1(' + localDemandKey + ')');
  // lp.addConstraint(new Row().Add(decisionVariableSG2Surplus,1),'GE', 0, 'Surplus SG2(' + localDemandKey + ')');
  // lp.addConstraint(new Row().Add(decisionVariableSG1Slack,1),'GE', 0, 'Slack SG1(' + localDemandKey + ')');
  // lp.addConstraint(new Row().Add(decisionVariableSG2Slack,1),'GE', 0, 'Slack SG2(' + localDemandKey + ')');
  // objective=objective.Add(decisionVariableSG1Surplus,1).Add(decisionVariableSG2Surplus,1).Add(decisionVariableSG1Slack,1).Add(decisionVariableSG2Slack,1);

  var demandConstraint = [];
  for (var dIndex = 0; dIndex < demandKeys.length; dIndex++) {
    var localDemandKey = demandKeys[dIndex];
    var demandValue = demandValues[dIndex].demand;
    var decisionVariables = demandValues[dIndex].decisionVariables;
    lp.addConstraint(new Row().Add(decisionVariables.SG1, 1).Add(decisionVariables.SG2, 1), 'EQ', demandValue, 'demand (' + localDemandKey + ')');
    lp.addConstraint(new Row().Add(decisionVariables.SG1, 1).Add(decisionVariables.SG1Surplus, 1).Add(decisionVariables.SG1Slack, -1), 'EQ', demandValue * 0.55, 'demand SG1(' + localDemandKey + ')');
    lp.addConstraint(new Row().Add(decisionVariables.SG2, 1).Add(decisionVariables.SG2Surplus, 1).Add(decisionVariables.SG2Slack, -1), 'EQ', demandValue * 0.45, 'demand SG2(' + localDemandKey + ')');
    lp.addConstraint(new Row().Add(decisionVariables.SG1Surplus, 1), 'GE', 0, 'Surplus SG1(' + localDemandKey + ')');
    lp.addConstraint(new Row().Add(decisionVariables.SG2Surplus, 1), 'GE', 0, 'Surplus SG2(' + localDemandKey + ')');
    lp.addConstraint(new Row().Add(decisionVariables.SG1Slack, 1), 'GE', 0, 'Slack SG1(' + localDemandKey + ')');
    lp.addConstraint(new Row().Add(decisionVariables.SG2Slack, 1), 'GE', 0, 'Slack SG2(' + localDemandKey + ')');
    objective = objective.Add(decisionVariables.SG1Surplus, 1).Add(decisionVariables.SG2Surplus, 1).Add(decisionVariables.SG1Slack, 1).Add(decisionVariables.SG2Slack, 1);
  }

  // var operatorConstraint = [];
  // // var totalDiff = 0;
  // for (var dIndex = 0; dIndex < operatorKeys.length; dIndex++) {
  //   operatorConstraint.push(new Row());
  //   if (operatorValues[dIndex].decisionVariables.length > 0) {
  //     var value = operatorValues[dIndex].supply; // * demandMGValues[demandMGIndex].demandPerc;
  //     var innerConstraints = new Row();
  //     var innerConstraintsAdded = false;
  //     for (var j = 0; j < operatorValues[dIndex].decisionVariables.length; j++) {
  //       operatorConstraint[dIndex] = operatorConstraint[dIndex].Add(operatorValues[dIndex].decisionVariables[j], 1);
  //       var SGValue = 0;
  //       if (operatorValues[dIndex].decisionVariables[j].indexOf(":::SG1") > -1) {
  //         SGValue = value * 0.55;
  //       } else if (operatorValues[dIndex].decisionVariables[j].indexOf(":::SG2") > -1) {
  //         SGValue = value * 0.45;
  //       } else {
  //         throw new Error("invalid Sub Group", operatorValues[dIndex].decisionVariables[j]);
  //       }
  //       if (SGValue === parseInt(SGValue)) {
  //         SGValue -= 0.00001;
  //       }
  //       // console.log(operatorValues[dIndex].decisionVariables[j], value, value * 0.1);
  //       // totalDiff += value * 0.1;
  //       var SGConstraint = new Row();
  //       SGConstraint = SGConstraint.Add(operatorValues[dIndex].decisionVariables[j], 1);
  //
  //       lp.addConstraint(SGConstraint, 'GE', Math.floor(SGValue), 'MG (' + operatorValues[dIndex].key + ')');
  //       lp.addConstraint(SGConstraint, 'LE', Math.ceil(SGValue), 'MG (' + operatorValues[dIndex].key + ')');
  //
  //       if (operatorValues[dIndex].decisionVariables[j].indexOf(":::SG1") > -1) {
  //         // objective = objective.Add(operatorValues[dIndex].decisionVariables[j], 1);
  //         innerConstraints = innerConstraints.Add(operatorValues[dIndex].decisionVariables[j], -1);
  //         innerConstraintsAdded = true;
  //       } else if (operatorValues[dIndex].decisionVariables[j].indexOf(":::SG2") > -1) {
  //         // objective = objective.Add(operatorValues[dIndex].decisionVariables[j], -1);
  //         innerConstraints = innerConstraints.Add(operatorValues[dIndex].decisionVariables[j], 1);
  //         innerConstraintsAdded = true;
  //       }
  //     }
  //     if (innerConstraintsAdded == true) {
  //       lp.addConstraint(innerConstraints, 'LE', 0, 'SG (' + operatorValues[dIndex].key + ')');
  //     }
  //     lp.addConstraint(operatorConstraint[dIndex], 'GE', operatorValues[dIndex].supply - 1, 'supply (' + operatorValues[dIndex].key + ')');
  //     lp.addConstraint(operatorConstraint[dIndex], 'LE', operatorValues[dIndex].supply, 'supply (' + operatorValues[dIndex].key + ')');
  //   } else {
  //     lp.addConstraint(operatorConstraint[dIndex], 'EQ', 0, 'supply (' + operatorValues[dIndex].key + ')');
  //   }
  // }

  // console.log(totalDiff / 2, totalDemand / 10);
  // lp.addConstraint(objective, 'GE', totalDemand / 10, 'demand cap');
  // console.log(objective);
  lp.setObjective(objective);
  // console.log(lp.dumpProgram());
  var modelResult = lp.solve();
  console.log(modelResult);
  console.log('objective =', lp.getObjectiveValue());
  // console.log(lp.getSolutionVariables());
  if (modelResult.code === 0) {
    //   var rows = [];
    //   rows.push("Plant,Cluster,SubCluster,Operator,TruckType,Part2,Allocation");
    for (var dIndex = 0; dIndex < decisionVariables.length; dIndex++) {
      console.log(decisionVariables[dIndex].key, ' =', lp.get(decisionVariables[dIndex].key));
      //     var keys = decisionVariables[dIndex].key.split(":::");
      //     var outputValue = lp.get(decisionVariables[dIndex].key);
      //     if (outputValue > 0) {
      //       keys.push(lp.get(decisionVariables[dIndex].key));
      //       rows.push(keys.join());
      //     }
    }
    //   fs.writeFileSync(filesDIR + "R1 - Indent Summary by Sub-bucket.csv", rows.join("\n"));
    //
    for (var cIndex = 0; cIndex < constraintVariables.length; cIndex++) {
      console.log(constraintVariables[cIndex].key, ' =', lp.calculate(constraintVariables[cIndex].key));
    }
  }
  process.exit(0);
}
runModel();
