// solve http://people.brunel.ac.uk/~mastjjb/jeb/or/morelp.html

var fs = require('fs');
var lpsolve = require('lp_solve');
var demand = readCsvFile('Demand.csv', 3, true);
var supply = readCsvFile('Supply.csv', 3, true);
//console.log(demand, supply);

var Row = lpsolve.Row;

var objective = new Row();
var lp = new lpsolve.LinearProgram();

//ClusterWise-Demand
var demandKeys=[];
var demandValues=[];
for (var dIndex = 1; dIndex < demand.length; dIndex++) {
    var localIndex = demandKeys.indexOf(demand[dIndex][0]);
    if(localIndex == -1){
        demandKeys.push(demand[dIndex][0]);
        demandValues.push({ key: demandKeys[demandKeys.length-1], demand: parseInt(demand[dIndex][2]), decisionVariables: [] });
    }
    else {
        demandValues[localIndex].demand += parseInt(demand[dIndex][2]);
    }
}

//ClusterWise-Part1Wise-Demand
var demandMGKeys=[];
var demandMGValues=[];
for (var dIndex = 1; dIndex < demand.length; dIndex++) {
    demandMGKeys.push(demand[dIndex][0]+"_"+demand[dIndex][1]);
    demandMGValues.push({ key: demandMGKeys[demandMGKeys.length-1], demand: parseInt(demand[dIndex][2]), decisionVariables: [] });
}

var decisionVariables=[];

var operatorKeys=[];
var operatorValues=[];

for (var i = 1; i < supply.length; i++) {
    var operatorIndex = operatorKeys.indexOf(supply[i][0]+'_'+supply[i][1]);
    if(operatorIndex == -1){
        operatorKeys.push(supply[i][0]+'_'+supply[i][1]);
        operatorValues.push({ key: operatorKeys[operatorKeys.length-1], supply: supply[i][2], decisionVariables: [] });
        operatorIndex = operatorKeys.length-1;
    }

    var demandIndex = demandKeys.indexOf(supply[i][0]);
    if(demandIndex == -1){
        demandKeys.push(supply[i][0]);
        demandValues.push({ key: demandKeys[demandKeys.length-1], demand: 0, decisionVariables: [] });
    }
    for (var iMG = 1; iMG < 4; iMG++) {
        var demandMGIndex = demandMGKeys.indexOf(supply[i][0]+"_MG"+iMG);
        if(demandMGIndex == -1){
            demandMGKeys.push(supply[i][0]+"_MG"+iMG);
            demandMGValues.push({ key: demandMGKeys[demandMGKeys.length-1], demand: 0, decisionVariables: [] });
            demandMGIndex = demandMGKeys.length-1;
        }
        for (var iSG = 1; iSG < 3; iSG++) {
            var variableName = supply[i][0]+'_'+supply[i][1]+'_'+'MG'+iMG+'_SG'+iSG;//C1_O1_MG1_SG1
            var decisionVariable = lp.addColumn(variableName, true);
            //objective = objective.Add(decisionVariable, 1);
            decisionVariables.push({key:variableName, value:decisionVariable});

            demandValues[demandIndex].decisionVariables.push(decisionVariable);
            demandMGValues[demandMGIndex].decisionVariables.push(decisionVariable);
            operatorValues[operatorIndex].decisionVariables.push(decisionVariable);
        }
    }
}

for (var dIndex = 0; dIndex < demandMGValues.length; dIndex++) {
    var cIndex = demandKeys.indexOf(demandMGValues[dIndex].key.split("_")[0]);
    demandMGValues[dIndex].demandPerc = (1.0 * demandMGValues[dIndex].demand) / demandValues[cIndex].demand;
}

var demandConstraint = [];
for (var dIndex = 0; dIndex < demandKeys.length; dIndex++) {
    demandConstraint.push(new Row());
    if (demandValues[dIndex].decisionVariables.length > 0) {
        for (var j = 0; j < demandValues[dIndex].decisionVariables.length; j++) {
            demandConstraint[dIndex] = demandConstraint[dIndex].Add(demandValues[dIndex].decisionVariables[j], 1);
        }
        lp.addConstraint(demandConstraint[dIndex], 'EQ', demandValues[dIndex].demand, 'demand (' + demandValues[dIndex].key + ')');
    } else {
        lp.addConstraint(demandConstraint[dIndex], 'EQ', 0, 'demand (' + demandValues[dIndex].key + ')');
    }
}

var operatorConstraint = [];
for (var dIndex = 0; dIndex < operatorKeys.length; dIndex++) {
    operatorConstraint.push(new Row());
    if (operatorValues[dIndex].decisionVariables.length > 0) {
        for (var demandMGIndex = 0; demandMGIndex < demandMGKeys.length; demandMGIndex++) {
            var MGConstraint = new Row();
            var demandMGKeyParts = demandMGKeys[demandMGIndex].split("_");
            var value = operatorValues[dIndex].supply * demandMGValues[demandMGIndex].demandPerc;
            var innerConstraints = new Row();
            for (var j = 0; j < operatorValues[dIndex].decisionVariables.length; j++) {
                if(operatorValues[dIndex].decisionVariables[j].indexOf(demandMGKeyParts[0]+"_")>-1
                && operatorValues[dIndex].decisionVariables[j].indexOf("_"+demandMGKeyParts[1])>-1){
                    operatorConstraint[dIndex] = operatorConstraint[dIndex].Add(operatorValues[dIndex].decisionVariables[j], 1);
                    MGConstraint = MGConstraint.Add(operatorValues[dIndex].decisionVariables[j], 1);

                    var SGValue = 0;
                    if(operatorValues[dIndex].decisionVariables[j].indexOf("_SG1")>-1){
                        SGValue = value * 0.45;
                    }
                    else if(operatorValues[dIndex].decisionVariables[j].indexOf("_SG2")>-1){
                        SGValue = value * 0.55;
                    }
                    else {
                        throw new Error("invalid Sub Group", operatorValues[dIndex].decisionVariables[j]);
                    }
                    var SGConstraint = new Row();
                    SGConstraint = SGConstraint.Add(operatorValues[dIndex].decisionVariables[j], 1);
                    lp.addConstraint(SGConstraint, 'GE', Math.floor(SGValue), 'MG (' + operatorValues[dIndex].key + ')');
                    lp.addConstraint(SGConstraint, 'LE', Math.ceil(SGValue), 'MG (' + operatorValues[dIndex].key + ')');

                    if(operatorValues[dIndex].decisionVariables[j].indexOf("_SG1")>-1){
                        innerConstraints = innerConstraints.Add(operatorValues[dIndex].decisionVariables[j], 1);
                    }
                    else if(operatorValues[dIndex].decisionVariables[j].indexOf("_SG2")>-1){
                        innerConstraints = innerConstraints.Add(operatorValues[dIndex].decisionVariables[j], -1);
                    }
                }
            }
            lp.addConstraint(innerConstraints, 'LE', 0, 'SG (' + operatorValues[dIndex].key + ')');
            lp.addConstraint(MGConstraint, 'GE', Math.floor(value), 'MG (' + operatorValues[dIndex].key + ')');
            lp.addConstraint(MGConstraint, 'LE', Math.ceil(value), 'MG (' + operatorValues[dIndex].key + ')');
        }
        lp.addConstraint(operatorConstraint[dIndex], 'EQ', operatorValues[dIndex].supply, 'supply (' + operatorValues[dIndex].key + ')');
    } else {
        lp.addConstraint(operatorConstraint[dIndex], 'EQ', 0, 'supply (' + operatorValues[dIndex].key + ')');
    }
}

var demandMGConstraint = [];
for (var dIndex = 0; dIndex < demandMGKeys.length; dIndex++) {
    demandMGConstraint.push(new Row());
    if (demandMGValues[dIndex].decisionVariables.length > 0) {
        for (var j = 0; j < demandMGValues[dIndex].decisionVariables.length; j++) {
            demandMGConstraint[dIndex] = demandMGConstraint[dIndex].Add(demandMGValues[dIndex].decisionVariables[j], 1);
        }
        lp.addConstraint(demandMGConstraint[dIndex], 'EQ', demandMGValues[dIndex].demand, 'demand (' + demandMGValues[dIndex].key + ')');
    } else {
        lp.addConstraint(demandMGConstraint[dIndex], 'EQ', 0, 'demand (' + demandMGValues[dIndex].key + ')');
    }
}

//var operatorIndex = operatorKeys.indexOf(supply[i][0]+'_'+supply[i][1]);
// var operatorConstraint = [];
// for (var iMG = 1; iMG < 4; iMG++) {
//     for (var dIndex = 0; dIndex < operatorKeys.length; dIndex++) {
//         var operatorSG=[];
//         for (var j = 0; j < operatorValues[dIndex].decisionVariables.length; j++) {
//             if(operatorValues[dIndex].decisionVariables[j].indexOf("_MG"+iMG) > -1){
//                 operatorSG.push(operatorValues[dIndex].decisionVariables[j]);
//             }
//         }
//         if(operatorSG.length>0){
//             operatorConstraint.push({decisionVariables: operatorSG, demand:operatorValues[dIndex].supply});
//         }
//     }
// }

// console.log(operatorConstraint);

// for (var iPanelty = 1; iPanelty < operatorConstraint.length; iPanelty++) {
//     // for (var iSubPanelty = 0; iSubPanelty < operatorConstraint[iPanelty-1].decisionVariables.length; iSubPanelty++) {
//     //     var val = (iPanelty%2 == 0?1:1)/operatorConstraint[iPanelty-1].demand;
//     //     objective = objective.Add(operatorConstraint[iPanelty-1].decisionVariables[iSubPanelty], val);
//     //     console.log(operatorConstraint[iPanelty-1].decisionVariables[iSubPanelty], val);
//     // }
//     // for (var iSubPanelty = 0; iSubPanelty < operatorConstraint[iPanelty].decisionVariables.length; iSubPanelty++) {
//     //     var val = (iPanelty%2 == 0?-1:-1)/operatorConstraint[iPanelty].demand;
//     //     objective = objective.Add(operatorConstraint[iPanelty].decisionVariables[iSubPanelty], val);
//     //     console.log(operatorConstraint[iPanelty].decisionVariables[iSubPanelty], val);
//     // }
// }

//console.log("objective", objective);
lp.setObjective(objective);

console.log(lp.dumpProgram());
console.log(lp.solve());
console.log('objective =', lp.getObjectiveValue());

for (var dIndex = 0; dIndex < decisionVariables.length; dIndex++) {
    console.log(decisionVariables[dIndex].key,' =', lp.get(decisionVariables[dIndex].key));
}

//console.log(decisionVariables);

//
// var x = lp.addColumn('x', true); // lp.addColumn('x', true) for integer variable
// var y = lp.addColumn('y', true); // lp.addColumn('y', false, true) for binary variable
//
//
// var objective = new Row().Add(x, 1).Add(y, 1);
//
// lp.setObjective(objective);


// lp.addConstraint(machineatime, 'LE', 2400, 'machine a time')
//
// var machinebtime = new Row().Add(x, 30).Add(y, 33);
// lp.addConstraint(machinebtime, 'LE', 2100, 'machine b time')
//
// lp.addConstraint(new Row().Add(x, 1), 'GE', 75 - 30, 'meet demand of x')
// lp.addConstraint(new Row().Add(y, 1), 'GE', 95 - 90, 'meet demand of y')
//
// console.log(lp.dumpProgram());
// console.log(lp.solve());
// console.log('objective =', lp.getObjectiveValue())
// console.log('x =', lp.get(x));
// console.log('y =', lp.get(y));
// console.log('machineatime =', lp.calculate(machineatime));
// console.log('machinebtime =', lp.calculate(machinebtime));

function readCsvFile(path, fieldsLength, convertUpper){
    var data = fs.readFileSync(path);
    var rows = data.toString().split("\r\n")
    for (var rIndex = 0; rIndex < rows.length; rIndex++) {
        if(rows[rIndex].length>0){
            rows[rIndex]=rows[rIndex].split(",");
            if(rows[rIndex].length != fieldsLength){
                console.log(fieldsLength," fields required. Found: ",rows[rIndex].length, "Data: ", rows[rIndex]);
                rows.splice(rIndex, 1);
                rIndex--;
            }
            else {
                if(convertUpper!=false){
                    for (var fIndex = 0; fIndex < rows[rIndex].length; fIndex++) {
                        rows[rIndex][fIndex] = rows[rIndex][fIndex].toUpperCase();
                    }
                }
            }
        }
        else {
            rows.splice(rIndex, 1);
            rIndex--;
        }
    }
    return rows;
}
