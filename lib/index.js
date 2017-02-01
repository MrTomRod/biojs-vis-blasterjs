/*
 * biojs-vis-blasterjs
 * https://github.com/sing-group/blasterjs
 *
 * Copyright (c) 2016 SING - Sistemas Informaticos de Nueva Generacion
 * Licensed under the MIT license.
 *
 *
 * BlasterJS
 *
 * @class
 * @extends Biojs
 *
 * @author <a href="mailto:aiblanco@uvigo.es">Aitor Blanco Miguez</a>
 * @version 0.1.1
 * @category 3
 *
 * @requires Bootstrap 3
 * @dependency <link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/3.3.6/css/bootstrap.min.css" integrity="sha384-1q8mTJOASx8j1Au+a5WDVnPi2lkFfwwEAa8hDDdjZlpLegxhjVME1fgjWPGmkzs7" crossorigin="anonymous"></link>
 *
 * @requires <a href='html2canvas.js'>HTML2CANVAS</a>
 * @dependency <script type="text/javascript" src="lib/html2canvas.js"></script>
 *
 *
 * @param {Object} options An object with the options for BlasterJS component.
 *
 * @option {string} input
 *    Identifier of the INPUT tag where the BLAST output file should be selected.
 *
 * @option {string} multipleAlignments
 *    Identifier of the DIV tag where the multiple alignments should be displayed.
 *
 * @option {string} alignmentsTable
 *    Identifier of the DIV tag where the alignments table should be displayed.
 *
 * @option {string} singleAlignment
 *    Identifier of the DIV tag where the single should be displayed.
 * 
 * @example
 * var instance = new Biojs.blasterjs({
 *      input: "blastinput",
 *      multipleAlignments: "blast-multiple-alignments",
 *      alignmentsTable: "blast-alignments-table",
        singleAlignment: "blast-single-alignment"
 * });
 */


var blasterjs;
var Class = require('js-class');
module.exports = blasterjs = Class(
    /** @lends Biojs.blasterjs# */
    {
        constructor: function (options) {
            var self = this;

            require('js-extend').extend(this.opt, options);

            var css = 'table tbody tr td button:hover{ text-decoration: underline;}';
            var style = document.createElement('style');
            if (style.styleSheet) {
                style.styleSheet.cssText = css;
            } else {
                style.appendChild(document.createTextNode(css));
            }
            document.getElementsByTagName('head')[0].appendChild(style);
            if (self.opt.string) {
                var myBlob = new Blob([self.opt.string], {type : "text/plain"});
                var fakeEvent = {
                   target: {  files: [myBlob]   }
                };
                self._displayAlignments(fakeEvent, self);
            }else{
                document.getElementById(self.opt.input).addEventListener('change',  function(evt) { self._displayAlignments(evt, self) }, false);
            } 
        },
        
        /**
         * Default values for the options
         * @name Biojs.blasterjs-opt
         */
        opt : {
             input: "blastinput",
             multipleAlignments: "blast-multiple-alignments",
             alignmentsTable: "blast-alignments-table",
             singleAlignment: "blast-single-alignment"
        },
        
        /**
         * Private: Read and display BLAST alignments.
         * @ignore
         */
        _displayAlignments : function(evt, self) {
            if (window.File && window.FileReader && window.FileList && window.Blob) {
                var f = evt.target.files[0];
                if (f) {
                    var r = new FileReader();
                    r.onload = function(e) { 
                        var queryLenght = getQueryLenght(e.target.result); 
                        var alignments  = getAlignments(e.target.result);
                        createAlignmentComparison(alignments, queryLenght, true, self);
                        createAlignmentTable(alignments, self);
                        var hsps = alignments[0].hsp.length;
                        createSingleAlignment(alignments[0], self, hsps, 0);
                    }
                    r.readAsText(f);
                } else { 
                    alert('Failed to load file');
                }
            } else {
              alert('The File APIs are not fully supported by your browser.');
            }  
        
            function BlastAlignment (description,
                                    length,
                                    totalScore,
                                    queryCover,
                                    hsp){                
                this.description  = description;
                this.length       = length;
                this.totalScore   = totalScore;
                this.queryCover   = queryCover;
                this.hsp          = hsp;
            }

            function HSP (score,
                          eValue,
                          identities,
                          positives,
                          gaps,
                          queryStart,
                          query,
                          queryEnd,
                          comparison,
                          subjectStart,
                          subject,
                          subjectEnd ){
                this.score        = score;
                this.eValue       = eValue;
                this.identities   = identities;
                this.positives    = positives;
                this.gaps         = gaps;
                this.queryStart   = queryStart;
                this.query        = query;
                this.queryEnd     = queryEnd;
                this.comparison   = comparison;
                this.subjectStart = subjectStart;
                this.subject      = subject;
                this.subjectEnd   = subjectEnd;                
            }
            
            String.prototype.startsWith = function(prefix) {
                return this.indexOf(prefix) === 0;
            }

            function getQueryLenght(content){
                var lines = content.split('\n');
                var length = 0;
                for (var i = 0; i < lines.length; i++){
                    if(lines[i].startsWith('Length=')){
                        length = lines[i].split('=')[1];
                        break;
                    }
                }
                return length;
            }

            function getAlignments(content){
                var lines = content.split('\n');
                return parseBlastText(content);  
            }

            function parseBlastText(content){
                var lines = content.split('\n');
                var alignments = [];
                for (var i = 0; i < lines.length; i++){
                    if(lines[i].startsWith('>')){
                        var line1 = lines[i].split('>')[1];
                        var line2 = "";
                        var currentLine = i;
                        while (line2 == ""){
                            currentLine = currentLine +1;
                            if(lines[currentLine].startsWith('Length=')){
                                line2 = lines[currentLine];
                            }else{
                                line1 += lines[currentLine];
                            }
                        }
                        var description  = line1;
                        var length       = line2.split('=')[1];
                        var hsps = [];
                        var multiple = false;
                        do{
                            if(multiple){
                                currentLine = currentLine-1;   
                            }
                            if(lines[currentLine+2].startsWith(' Features in this part of subject sequence:')){                
                                currentLine = currentLine+3;
                            }
                            var score = lines[currentLine+2].split(',')[0].replace(/\s\s+/g, ' ').split(' ')[3];
                            var eValue       = lines[currentLine+2].split(',')[1].split(' ')[4];
                            var identities   = lines[currentLine+3].split(',')[0].split('(')[1].substr(0, lines[currentLine+3].split(',')[0].split('(')[1].length-2);
                            if(lines[0].startsWith('BLASTN')){
                                var positives = 'N/A';
                                var gaps    = lines[currentLine+3].split(',')[1].split('(')[1].substr(0, lines[currentLine+3].split(',')[1].split('(')[1].length-2);
                            }else{
                                var positives    = lines[currentLine+3].split(',')[1].split('(')[1].substr(0, lines[currentLine+3].split(',')[1].split('(')[1].length-2);
                                var gaps         = lines[currentLine+3].split(',')[2].split('(')[1].substr(0, lines[currentLine+3].split(',')[2].split('(')[1].length-2);
                            }
                            if(lines[currentLine+4].split(',')[0].split(' ')[1] == 'Frame' || lines[currentLine+4].startsWith(' Strand')){
                                currentLine = currentLine+1;   
                            }
                            var queryStart = lines[currentLine+5].substring(5).replace(/^\s+/g, '').split(' ')[0];
                            var query = lines[currentLine+5].substring(5).replace(/\s+/g, '').replace(/[0-9]/g, '');
                            var queryEnd = lines[currentLine+5].substring(5).replace(/^\s+/g, '').split(' ')[lines[currentLine+5].substring(5).replace(/^\s+/g, '').split(' ').length-1];
                            var comparison = lines[currentLine+6].replace(/^\s+/g, ''); 
                            var sbjctStart = lines[currentLine+7].substring(5).replace(/^\s+/g, '').split(' ')[0];
                            var sbjct = lines[currentLine+7].substring(5).replace(/\s+/g, '').replace(/[0-9]/g, '');
                            var sbjctEnd = lines[currentLine+7].substring(5).replace(/^\s+/g, '').split(' ')[lines[currentLine+7].substring(5).replace(/^\s+/g, '').split(' ').length-1];

                            currentLine = currentLine+9;
                            while (lines[currentLine].startsWith('Query')){
                                var nextQuery = lines[currentLine].substring(5).replace(/\s+/g, '').replace(/[0-9]/g, '');
                                query += nextQuery;
                                queryEnd = lines[currentLine].substring(5).replace(/^\s+/g, '').split(' ')[lines[currentLine].substring(5).replace(/^\s+/g, '').split(' ').length-1];
                                sbjct += lines[currentLine+2].substring(5).replace(/\s+/g, '').replace(/[0-9]/g, '');
                                sbjctEnd = lines[currentLine+2].substring(5).replace(/^\s+/g, '').split(' ')[lines[currentLine+2].substring(5).replace(/^\s+/g, '').split(' ').length-1];

                                var nextComparison = lines[currentLine+1].replace(/^\s+/g, '');
                                if(nextQuery.length > nextComparison.length){
                                    var diference = nextQuery.length-nextComparison.length;
                                    for(var j = 0; j < diference; j++){
                                        nextComparison = ' '+nextComparison;   
                                    }
                                }
                                comparison += nextComparison;
                                currentLine = currentLine+4;
                            }
                            var hsp = new HSP(score, eValue, identities, positives, gaps, queryStart, query, queryEnd, comparison, sbjctStart, sbjct, sbjctEnd);
                            hsps.push(hsp);
                            multiple = true;
                        }while(lines[currentLine+1].startsWith(' Score'));
                        var totalScore = parseFloat(hsps[0].score);
                        for(var x = 1; x< hsps.length; x++){
                            totalScore = totalScore + parseFloat(hsps[x].score);   
                        }
                        var alignment = new BlastAlignment( description, length, totalScore.toFixed(1), getQueryCover(hsps, getQueryLenght(content)), hsps);
                        alignments.push(alignment);
                    }
                }
                return alignments;
            }

            function getQueryCover(hsps, length){
                var cover = 0;
                var noOver = getHSPWithoutOverlapping(hsps);
                for(var i=0; i<noOver.length; i++){
                    cover = cover + parseInt(100 * (noOver[i].end - noOver[i].start +1) / length);               
                }
                return  cover;   
            }
            
            function getHSPWithoutOverlapping(hsps){
                var hspNoOver=[];
                for(var i=0; i<hsps.length; i++){
                    hspNoOver.push({start:parseInt(hsps[i].queryStart),end:parseInt(hsps[i].queryEnd)});                    
                }
                return getNoOverlappingArray(partitionIntoOverlappingRanges(hspNoOver));
            }
            
            function partitionIntoOverlappingRanges(array) {
              array.sort(function (a,b) {
                if (a.start < b.start)
                  return -1;
                if (a.start > b.start)
                  return 1;
                return 0;
              });
              var getMaxEnd = function(array) {
                if (array.length==0) return false;
                array.sort(function (a,b) {
                  if (a.end < b.end)
                    return 1;
                  if (a.end > b.end)
                    return -1;
                  return 0;
                });
                return array[0].end;    
              };
              var rarray=[];
              var g=0;
              rarray[g]=[array[0]];

              for (var i=1,l=array.length;i<l;i++) {
                if ( (array[i].start>=array[i-1].start)
                     &&
                     (array[i].start<getMaxEnd(rarray[g]))
                ) {    
                  rarray[g].push(array[i]);
                } else {
                  g++;   
                  rarray[g]=[array[i]];
                }
              }
              return rarray;
            }
            
            function getNoOverlappingArray(array){
                var result = [];
                for(var i=0; i<array.length; i++){
                    var start=array[i][0].start;
                    var end= array[i][0].end;
                    for(var j=0; j<array[i].length; j++){
                        if(array[i][j].start<start)
                            start = array[i][j].start;
                        if(array[i][j].end>end)
                            end = array[i][j].end;
                    }
                    result.push({start:start,end:end});
                }
                return result;
            }
            
            function getColor(colored, score){
                var colorNb; 
                if (score<40){
                    colorNb=1;
                }else if (score>=40 && score<50){
                    colorNb=2;
                }else if (score>=50 && score<80){
                    colorNb=3;
                }else if (score>=80 && score<200){
                    colorNb=4
                }else {
                    colorNb=5;
                } 
                 return getDivColor(colored, colorNb);
            }

            function getDivColorText(div){
                switch(div) {
                    case 1:
                        return '<40';
                        break;
                    case 2:
                        return '40-50';
                        break;
                    case 3:
                        return '50-80';
                        break;
                    case 4:
                        return '80-200';
                        break;
                    case 5:
                        return '>=200';
                        break;
                    default:
                        return '0';
                }
            }

            function getDivColor(colored, div){
                if(colored){
                    switch(div) {
                        case 1:
                            return '#5C6D7E';
                            break;
                        case 2:
                            return '#9B59B6';
                            break;
                        case 3:
                            return '#5CACE2';
                            break;
                        case 4:
                            return '#57D68D';
                            break;
                        case 5:
                            return '#C0392B';
                            break;
                        default:
                            return '#FFF';
                    }
                }else{
                    switch(div) {
                        case 1:
                            return '#BCBCBC';
                            break;
                        case 2:
                            return '#989898';
                            break;
                        case 3:
                            return '#747474';
                            break;
                        case 4:
                            return '#565656';
                            break;
                        case 5:
                            return '#343434';
                            break;
                        default:
                            return '#FFF';
                    }
                }
            }

            function selectAlignment(alignment){
                var item = document.getElementById(alignment).parentElement.parentElement;
                var items = document.getElementsByClassName('alignment-table-description');
                var i;
                for (i = 0; i < items.length; i++) {
                    items[i].style.fontWeight = 'normal';
                    items[i].parentElement.parentElement.style.fontWeight = 'normal';
                }
                item.style.fontWeight = 'bold';
                document.getElementById(alignment).style.fontWeight = 'bold';
            }

            function createColorsDiv(colored){
                var container  = document.createElement('div');
                var divSpace   = document.createElement('div');
                var divClear   = document.createElement('div');
                container.style.color = '#EEE';
                divSpace.style.minWidth  = '50px';
                divSpace.style.minHeight = '10px';
                divSpace.style.float     = 'left';
                container.appendChild(divSpace);
                for(var i = 1; i <= 5; i++){
                    var div = document.createElement('div');
                    div.style.minWidth        = '100px';
                    div.style.textAlign       = 'center';
                    div.style.float           = 'left';        
                    div.innerHTML             = getDivColorText(i).bold();
                    div.style.backgroundColor = getDivColor(colored, i);
                    container.appendChild(div);
                }
                divClear.style.clear = 'both';
                container.appendChild(divClear);
                return container;
            }

            function createQueryDiv(colored){
                var container  = document.createElement('div');
                var divSpace   = document.createElement('div');
                var divQuery   = document.createElement('div');
                var divClear   = document.createElement('div');
                container.style.marginTop = '3px';
                container.style.color     = '#5C6D7E';
                container.style.fontSize  = '10px';
                divSpace.style.width = '50px';
                divSpace.innerHTML   = 'QUERY'.bold();
                divSpace.style.float = 'left';
                divQuery.style.width     = '500px';
                divQuery.style.height    = '10px';
                divQuery.style.float     = 'left';
                divQuery.style.marginTop = '2px';
                divClear.style.clear = 'both';
                if(colored){
                    divQuery.style.backgroundColor = '#C0392B'; 
                } else{
                    divQuery.style.backgroundColor = '#343434';         
                }
                container.appendChild(divSpace);
                container.appendChild(divQuery);
                container.appendChild(divClear);
                return container;
            }

            function createNumbersDiv(lenght){
                var container    = document.createElement('div');
                var divSpace     = document.createElement('div');
                var divNumbers   = document.createElement('div');
                var divClear     = document.createElement('div');
                container.style.marginBottom = '5px';
                container.style.fontSize     = '11px';
                divSpace.style.minWidth  = '50px';
                divSpace.style.minHeight = '10px';
                divSpace.style.float     = 'left';    
                divNumbers.style.float = 'left';
                divClear.style.clear = 'both';  
                divNumbers = divideDivNumbers(divNumbers, lenght);  
                container.appendChild(divSpace);
                container.appendChild(divNumbers);
                container.appendChild(divClear);
                return container;
            }

            function divideDivNumbers(container, lenght){
                var divClear = document.createElement('div');
                if(lenght > 4){
                    if(lenght % 5 == 0){
                        container = createDivisionsDivNumbers(container, 5, lenght/5, 100);
                    }else{
                        var pixels = 500/(5+((lenght%5)/5));
                        container = createDivisionsDivNumbers(container, 5, parseInt(lenght/5), parseInt(pixels));            
                        //Podemos hacerlo o no
                        var pxrest = parseInt(500-(pixels*5));
                        var div = document.createElement('div');
                        div.style.float = 'left';
                        div.style.width = pxrest+'px';
                        div.style.textAlign = 'right';
                        div.innerHTML = lenght;
                        container.appendChild(div);
                    }
                }else{
                    container = createDivisionsDivNumbers(container, lenght, 1, parseInt(500/lenght));
                }    
                divClear.style.clear = 'both'; 
                container.appendChild(divClear);
                return container;
            }

            function createDivisionsDivNumbers(container, divisions, size, pixels){
                for(var i = 0; i<divisions; i++){
                    if(i == 0){
                        var px2  = pixels/2;
                        var div1 = document.createElement('div');
                        var div2 = document.createElement('div');
                        div1.style.float     = 'left';
                        div1.style.width     = px2+'px';
                        div1.style.textAlign = 'left';
                        div1.innerHTML       = '0';
                        div2.style.float     = 'left';
                        div2.style.width     = px2+'px';
                        div2.style.textAlign = 'right';
                        div2.innerHTML       = size*(i+1);
                        container.appendChild(div1); 
                        container.appendChild(div2); 
                    }else{
                        var div = document.createElement('div');
                        div.style.float     = 'left';
                        div.style.width     = pixels+'px';
                        div.style.textAlign = 'right';
                        div.innerHTML       = size*(i+1);
                        container.appendChild(div);
                    }
                }
                return container;
            }


            function createHeader(container, colored, lenght){   
                var text    = document.createElement('div');
                var colors  = createColorsDiv(colored);
                var query   = createQueryDiv(colored);
                var numbers = createNumbersDiv(lenght);
                text.style.color         = '#5C6D7E';
                text.style.textAlign     = 'center';
                text.style.paddingBottom = '5px';
                text.innerHTML           = 'COLOR KEY FOR ALIGNMENT SCORES'.bold();
                container.appendChild(text);
                container.appendChild(colors);
                container.appendChild(query);
                container.appendChild(numbers);
                return container;
            }
            
            function createBody(alignments, queryLenght, container, colored){
                var alignmentContainer = document.createElement('div');
                alignmentContainer.style.paddingBottom = '10px';
                for(var i = 0; i < alignments.length; i++){
                    var alignment = createAlignmentDiv(getColor(colored, alignments[i].hsp[0].score), alignments[i], queryLenght);
                    alignment.style.marginBottom = '4px';
                    alignmentContainer.appendChild(alignment);
                }
                container.appendChild(alignmentContainer);
                return container;
            }
                        
            function createAlignmentDiv(color, alignment, queryLenght){ 
                var noOver = getHSPWithoutOverlapping(alignment.hsp);
                
                var container = document.createElement('div');
                var divClear  = document.createElement('div');
                container.style.minHeight = '12px';
                
                for(var i =0; i<noOver.length; i++){
                    var white = document.createElement('div');
                    var colored = document.createElement('div');
                    var link = document.createElement('a');
                    if(i==0){
                        if(noOver[0].start == 1)                           
                           var init = parseInt(50+((500*(noOver[0].start-1))/queryLenght));
                        else
                            var init = parseInt(50+((500*(noOver[0].start))/queryLenght));
                        var offset = parseInt(550-init-(500*(queryLenght-noOver[0].end)/queryLenght));
                    }else{
                        var  init = parseInt((500*(noOver[i].start-noOver[i-1].end)/queryLenght));
                        var offset = parseInt((500*(noOver[i].end-noOver[i].start)/queryLenght));
                    }
                    white.style.width           = init+'px';
                    white.style.minHeight       = '4px';
                    white.style.float           = 'left';
                    colored.style.width           = offset+'px';
                    colored.style.minHeight       = '12px';
                    colored.style.float           = 'left';
                    colored.style.backgroundColor =  color;    
                    colored.onmouseout            = function(){document.getElementById('defline').value=' Mouse over to show defline and scores, click to show alignments';};
                    colored.onmouseover           = function(){document.getElementById('defline').value=' '+alignment.description+'. S='+alignment.score+' E='+alignment.eValue;};
                    
                    
                    link.href = '#'+alignment.description.split(' ')[0];  
                    link.onclick=function(){ selectAlignment(alignment.description.split(' ')[0]); };
                    link.appendChild(colored);
                    container.appendChild(white);
                    container.appendChild(link);
                }
                divClear.style.clear = 'both';
                container.appendChild(divClear);
                return container;
            }

            function createChangeColorButton(alignments, lenght, colored, self){
                var button = document.createElement('button');
                button.id                = 'changeColors';
                button.className         = 'btn';
                button.style.marginRight = '10px';
                button.style.marginTop   = '5px';
                if(colored == true){
                    var text = document.createTextNode('Click to change colors to grayscale');
                }else{
                    var text = document.createTextNode('Click to change colors to full colored');
                }
                button.appendChild(text);
                button.onclick=function(){ changeColors(alignments, lenght, button, colored, self); };
                return button;
            }

            function createDownloadButton(){
                var button = document.createElement('button');
                button.id              = 'downloadAlignments';
                button.className       = 'btn';
                button.style.marginTop = '5px';
                var text = document.createTextNode('Download as image'); 
                button.appendChild(text); 
                button.addEventListener('click', downloadAlignmentsImg);
                return button;
            }

            function changeColors(alignments, lenght, button, colored, self){   
                if(colored == true){
                    colored = false;
                }else{
                    colored = true;   
                }
                button.removeChild(button.childNodes[0]);
                var blastDiv = document.getElementById(self.opt.multipleAlignments);
                while (blastDiv.firstChild) {
                    blastDiv.removeChild(blastDiv.firstChild);
                }
                createAlignmentComparison(alignments, lenght, colored, self);
            }

            function downloadAlignmentsImg(){
                var buttons   = document.getElementById('blast-multiple-alignments-buttons');
                var input     = document.getElementById('defline');
                var container = document.getElementById('alignments-container');
                container.removeChild(buttons);
                container.removeChild(input);
                html2canvas(container, {
                  onrendered: function(canvas) {
                    document.body.appendChild(canvas);
                    var a = document.createElement('a');
                    document.body.appendChild(a);
                    a.href     = canvas.toDataURL('img/png');
                    a.download = 'alignments.png';
                    a.click();
                    document.body.removeChild(canvas);
                    document.body.removeChild(a);
                    container.appendChild(input);
                    container.appendChild(buttons);
                  }
                });   
            }

            function createAlignmentComparison(alignments, queryLenght, colored, self){
                var blastDiv  = document.getElementById(self.opt.multipleAlignments);
                while(blastDiv.hasChildNodes()){
                    blastDiv.removeChild(blastDiv.firstChild);	
                }
                var container        = document.createElement('div');
                var containerButtons = document.createElement('div');
                var input            = document.createElement('input');
                var buttonColors     = createChangeColorButton(alignments, queryLenght, colored, self);
                var buttonDownload   = createDownloadButton();
                blastDiv.style.paddingTop = '20px';
                input.id    = 'defline';
                input.name  = 'defline';
                input.type  = 'text';
                input.value = ' Mouse over to show defline and scores, click to show alignments';
                input.style.width   = '556px';
                input.style.padding = '1px';
                input.style.border  = 0;
                input.style.cursos  = 'auto';    
                container.id                    = 'alignments-container';
                container.style.border          = 'thin solid #DDD';
                container.style.margin          = '0 auto';
                container.style.padding         = '10px';
                container.style.maxWidth        = '580px';
                container.style.backgroundColor = '#FFF';
                container = createHeader(container, colored, queryLenght);
                container = createBody(alignments, queryLenght, container, colored);
                container.appendChild(input);    
                containerButtons.style.textAlign = 'right';
                containerButtons.id              = 'blast-multiple-alignments-buttons';
                blastDiv.style.minWidth        = '580px';
                containerButtons.appendChild(buttonColors); 
                containerButtons.appendChild(buttonDownload);   
                container.appendChild(containerButtons);
                blastDiv.appendChild(container);
            }

            function createTableHeader(){
                var table       = document.createElement('table');
                var thead       = document.createElement('thead');
                var theadTr     = document.createElement('tr');
                var theadDesc   = document.createElement('th');
                var theadScore  = document.createElement('th');
                var theadEval   = document.createElement('th');
                var theadIdent  = document.createElement('th');
                var theadPos    = document.createElement('th');
                var theadGaps   = document.createElement('th');
                table.className = "table table-striped";
                theadDesc.innerHTML  = 'Description'.bold();
                theadScore.innerHTML = 'Max score'.bold();
                theadEval.innerHTML  = 'Total score'.bold();
                theadIdent.innerHTML = 'Query cover'.bold();
                theadPos.innerHTML   = 'E value'.bold();
                theadGaps.innerHTML  = 'Identities'.bold();
                theadTr.appendChild(theadDesc);
                theadTr.appendChild(theadScore);
                theadTr.appendChild(theadEval);
                theadTr.appendChild(theadIdent);
                theadTr.appendChild(theadPos);
                theadTr.appendChild(theadGaps);
                thead.appendChild(theadTr);
                table.appendChild(thead);
                return table;
            }

            function createTableButtons(alignments){
                var container = document.createElement('div');
                var butCSV    = document.createElement('button');
                var butImg    = document.createElement('button');
                container.style.textAlign = 'right';    
                butCSV.style.marginRight = '10px';
                butCSV.className         = 'btn';
                butCSV.innerHTML         = 'Download as csv';
                butCSV.onclick           = function(){ downloadTableCSV(alignments); };
                butImg.className = 'btn';
                butImg.innerHTML = 'Download as image';
                butImg.onclick   = function(){ downloadTableImg(); };
                container.appendChild(butCSV);
                container.appendChild(butImg);
                return container;
            }

            function createAlignmentTable(alignments, self){
                var tableDiv     = document.getElementById(self.opt.alignmentsTable);
                while(tableDiv.hasChildNodes()){
                    tableDiv.removeChild(tableDiv.firstChild);	
                }
                var imgContainer = document.createElement('div');
                var butContainer = createTableButtons(alignments);
                var table        = createTableHeader();
                var tbody        = document.createElement('tbody');
                tableDiv.style.paddingTop = '50px';
                imgContainer.style.backgroundColor = '#FFF';
                imgContainer.id                    = 'blast-alignments-table-img';
                for(var i = 0; i < alignments.length; i++){
                    var tr           = document.createElement('tr');
                    var tdDesc       = document.createElement('td');
                    var butDesc      = document.createElement('button');
                    butDesc.alignment = alignments[i];
                    butDesc.onclick   = function(){ 
                        if (self.opt.callback) {
                            self.opt.callback(this.alignment);
                        }else{
                            location.href='#'+self.opt.singleAlignment;
                            createSingleAlignment(this.alignment, self, this.alignment.hsp.length, 0);  
                        }
                    };
                    butDesc.id        = alignments[i].description.split(" ")[0];
                    butDesc.innerHTML = alignments[i].description;
                    butDesc.style.border = 0;
                    butDesc.style.padding = 0;
                    butDesc.style.display = 'inline';
                    butDesc.style.background = 'none';
                    butDesc.className = 'alignment-table-description';
                    tdDesc.appendChild(butDesc);
                    var tdScore       = document.createElement('td');
                    tdScore.innerHTML = alignments[i].hsp[0].score;
                    var tdEval       = document.createElement('td');
                    tdEval.innerHTML = alignments[i].totalScore;
                    var tdIdent       = document.createElement('td');
                    tdIdent.innerHTML = alignments[i].queryCover+"%";
                    var tdPos       = document.createElement('td');
                    tdPos.innerHTML = alignments[i].hsp[0].eValue;
                    var tdGaps       = document.createElement('td');
                    tdGaps.innerHTML = alignments[i].hsp[0].identities+"%";
                    tr.appendChild(tdDesc);
                    tr.appendChild(tdScore);
                    tr.appendChild(tdEval);
                    tr.appendChild(tdIdent);
                    tr.appendChild(tdPos);
                    tr.appendChild(tdGaps);
                    tbody.appendChild(tr);
                }
                table.appendChild(tbody);
                imgContainer.appendChild(table);
                tableDiv.appendChild(imgContainer);
                tableDiv.appendChild(butContainer);
            }

            function downloadTableImg(){
                var items = document.getElementsByClassName('alignment-table-description');
                var i;
                for (i = 0; i < items.length; i++) {
                    items[i].style.fontWeight = 'normal';
                    items[i].parentElement.parentElement.style.fontWeight = 'normal';
                }
                var container = document.getElementById('blast-alignments-table-img');
                html2canvas(container, {
                  onrendered: function(canvas) {
                    document.body.appendChild(canvas);
                    var a = document.createElement('a');
                    document.body.appendChild(a);
                    a.href = canvas.toDataURL('img/png');
                    a.download = 'alignments-table.png';
                    a.click();
                    document.body.removeChild(canvas);
                    document.body.removeChild(a);
                  }
                });   
            }

            function downloadTableCSV(alignments){
                var csvContent = 'data:text/csv;charset=utf-8,';
                csvContent += 'Description; Score; eValue; Identities; Positives; Gaps\n';

                for(var i = 0; i < alignments.length; i++){
                    csvContent += alignments[i].description;
                    csvContent += '; ';
                    csvContent += alignments[i].hsp[0].score;
                    csvContent += '; ';
                    csvContent += alignments[i].hsp[0].eValue;
                    csvContent += '; ';
                    csvContent += alignments[i].hsp[0].identities;
                    csvContent += '; ';
                    csvContent += alignments[i].hsp[0].positives;
                    csvContent += '; ';
                    csvContent += alignments[i].hsp[0].gaps;
                    csvContent += '\n';
                }
                var encodedUri = encodeURI(csvContent);
                var link = document.createElement('a');
                link.setAttribute('href', encodedUri);
                link.setAttribute('download', 'alignments-table.csv');
                link.click(); 
            }

            function createSingleAlignment(alignment, self, hsps, hsp){
                var alignmentDiv = document.getElementById(self.opt.singleAlignment);
                while(alignmentDiv.hasChildNodes()){
                    alignmentDiv.removeChild(alignmentDiv.firstChild);	
                }

                var alignmentPre = document.createElement('pre');
                var alignmentContainer = document.createElement('div');
                var buttonDownload = document.createElement('button');
                var span = document.createElement('span');   
                var statsDiv = document.createElement('div');
                var scoreDiv = document.createElement('div');
                var expectedDiv = document.createElement('div');
                var identitiesDiv = document.createElement('div');
                var positivesDiv = document.createElement('div');
                var gapsDiv = document.createElement('div');
                var divClear  = document.createElement('div');
                var queryDiv      = createSingleQueryDiv(alignment.hsp[hsp].query, alignment.hsp[hsp].queryStart, alignment.hsp[hsp].queryEnd);
                var comparisonDiv = createSingleComparisonDiv(alignment.hsp[hsp].comparison);
                var subjectDiv    = createSingleSubjectDiv(alignment.hsp[hsp].subject, alignment.hsp[hsp].subjectStart, alignment.hsp[hsp].subjectEnd); 

                alignmentPre.style.color         = '#2c3e50';
                alignmentPre.style.paddingTop    = '25px';
                alignmentPre.style.paddingBottom = '40px';
                alignmentPre.style.textAlign     = 'left';
                alignmentPre.style.fontFamily    = 'Helvetica,Arial,sans-serif';
                alignmentPre.id                  = 'blast-single-alignment-pre';
                alignmentContainer.style.margin     = '0 auto';
                alignmentContainer.style.display    = 'table';
                alignmentContainer.style.paddingTop = '30px';
                alignmentDiv.style.textAlign  = 'right';
                alignmentDiv.style.paddingTop = '50px';
                buttonDownload.className = 'btn';
                buttonDownload.innerHTML = 'Download as image';
                buttonDownload.onclick   = function(){ downloadSingleAlignmentImg(alignment); };
                span.innerHTML         = alignment.description;
                span.style.paddingLeft = '15px';
                span.style.fontWeight  = 'bold';
                span.style.fontSize    = '15px';
                span.style.fontFamily  =  'Helvetica,Arial,sans-serif';
                
                
                statsDiv.style.paddingTop = '20px';
                statsDiv.style.fontSize    = '14px';
                statsDiv.style.textAlign = 'center';
                statsDiv.style.fontFamily  =  'Helvetica,Arial,sans-serif';
                statsDiv.style.display = 'table';
                statsDiv.style.margin = '0px auto';
                statsDiv.style.width = '100%';
                scoreDiv.innerHTML = '<b>Score:</b></br>'+alignment.hsp[hsp].score;
                scoreDiv.style.float = 'left';
                scoreDiv.style.width = "20%";
                expectedDiv.innerHTML = '<b>Expect:</b></br>'+alignment.hsp[hsp].eValue;
                expectedDiv.style.float = 'left';
                expectedDiv.style.width = "20%";
                identitiesDiv.innerHTML = '<b>Identities:</b></br>'+alignment.hsp[hsp].identities+'%';
                identitiesDiv.style.float = 'left';
                identitiesDiv.style.width = "20%";
                positivesDiv.innerHTML = '<b>Positives:</b></br>'+alignment.hsp[hsp].positives+'%';
                positivesDiv.style.float = 'left';
                positivesDiv.style.width = "20%";
                gapsDiv.innerHTML = '<b>Gaps:</b></br>'+alignment.hsp[hsp].gaps+'%';
                gapsDiv.style.float = 'left';
                gapsDiv.style.width = "20%";
                divClear.style.clear = 'both';

                statsDiv.appendChild(scoreDiv);
                statsDiv.appendChild(expectedDiv);
                statsDiv.appendChild(identitiesDiv);
                statsDiv.appendChild(positivesDiv);
                statsDiv.appendChild(gapsDiv);
                statsDiv.appendChild(divClear);
                
                alignmentContainer.appendChild(queryDiv);
                alignmentContainer.appendChild(comparisonDiv);
                alignmentContainer.appendChild(subjectDiv);
                alignmentPre.appendChild(span);
                alignmentPre.appendChild(statsDiv);
                alignmentPre.appendChild(alignmentContainer);
                alignmentDiv.appendChild(alignmentPre);
                if(hsps > 1){
                    var buttonNext = document.createElement('button');  
                    buttonNext.className = 'btn';
                    buttonNext.id = 'blast-single-alignment-next';
                    buttonNext.innerHTML = 'Next HSP';
                    buttonNext.style.marginTop = '5px';
                    buttonNext.style.marginRight = '15px';
                    buttonNext.style.float = 'right';
                    if(hsp == hsps-1)
                        var goTo = 0;
                    else
                        var goTo = hsp+1;
                    buttonNext.onclick   = function(){ createSingleAlignment(alignment, self, hsps, goTo); }; 
                    alignmentPre.appendChild(buttonNext);
                }
                alignmentDiv.appendChild(buttonDownload);
            }

            function downloadSingleAlignmentImg(alignment){
                var container = document.getElementById('blast-single-alignment-pre');                
                var button = document.getElementById('blast-single-alignment-next');
                if(typeof(button) != 'undefined' && button != null){   
                    container.removeChild(button);
                }
                html2canvas(container, {
                  onrendered: function(canvas) {                    
                    document.body.appendChild(canvas);
                    var a = document.createElement('a');
                    document.body.appendChild(a);
                    a.href = canvas.toDataURL('img/png');
                    var tittle = alignment.description+'-alignment.png';
                    a.download = tittle;
                    a.click();
                    document.body.removeChild(canvas);
                    document.body.removeChild(a);
                    if(typeof(button) != 'undefined' && button != null)
                        container.appendChild(button);
                  }
                });   
            }

            function createSingleQueryDiv(query, start, end){
                var textDiv  = document.createElement('div');
                var startDiv = document.createElement('div');
                var endDiv   = document.createElement('div');
                var queryDiv = document.createElement('div');
                textDiv.innerHTML         = 'Query'.bold();
                textDiv.style.display     = 'inline-block';
                textDiv.style.marginRight = '20px';
                textDiv.style.textAlign   = 'right';
                textDiv.style.width       = '55px';
                startDiv.innerHTML = String(start).bold();
                startDiv.style.display = 'inline-block';
                startDiv.style.marginRight = '20px';
                startDiv.style.width       = '25px';
                endDiv.innerHTML         = String(end).bold();
                endDiv.style.display     = 'inline-block';
                endDiv.style.marginLeft  = '20px';
                endDiv.style.marginRight = '70px';
                queryDiv.appendChild(textDiv);
                queryDiv.appendChild(startDiv);
                for(var i = 0; i < query.length; i++){
                    var div = document.createElement('div');
                    div.style.backgroundColor = getAminoColor(query.charAt(i));
                    div.innerHTML             = query.charAt(i).bold();
                    div.style.width           = '18px';
                    div.style.textAlign       = 'center';
                    div.style.display         = 'inline-block';
                    queryDiv.appendChild(div);
                }
                queryDiv.appendChild(endDiv);
                return queryDiv;
            }

            function createSingleComparisonDiv(comparison){
                var comparisonDiv = document.createElement('div');
                var spaceDiv      = document.createElement('div');
                spaceDiv.style.minWidth  = '120px';
                spaceDiv.style.minHeight = '1px';
                spaceDiv.style.display   = 'inline-block';
                comparisonDiv.appendChild(spaceDiv);
                for(var i = 0; i < comparison.length; i++){
                    var div = document.createElement('div');
                    div.style.backgroundColor = getAminoColor(comparison.charAt(i));
                    div.innerHTML             = comparison.charAt(i).bold();
                    div.style.width           = '18px';
                    div.style.textAlign       = 'center';
                    div.style.display         = 'inline-block';
                    comparisonDiv.appendChild(div);
                }
                return comparisonDiv;
            }

            function createSingleSubjectDiv(subject, start, end){
                var textDiv    = document.createElement('div');
                var startDiv   = document.createElement('div');
                var endDiv     = document.createElement('div');
                var subjectDiv = document.createElement('div');
                textDiv.innerHTML         = 'Subject'.bold();
                textDiv.style.display     = 'inline-block';
                textDiv.style.textAlign   = 'right';
                textDiv.style.marginRight = '20px';
                textDiv.style.width       = '55px';
                startDiv.style.width       = '25px';
                startDiv.innerHTML         = String(start).bold();
                startDiv.style.display     = 'inline-block';
                startDiv.style.marginRight = '20px';
                endDiv.innerHTML         = String(end).bold();
                endDiv.style.display     = 'inline-block';
                endDiv.style.marginLeft  = '20px';
                endDiv.style.marginRight = '70px';
                subjectDiv.appendChild(textDiv);
                subjectDiv.appendChild(startDiv);
                for(var i = 0; i < subject.length; i++){
                    var div = document.createElement('div');
                    div.style.backgroundColor = getAminoColor(subject.charAt(i));
                    div.innerHTML             = subject.charAt(i).bold();
                    div.style.width           = '18px';
                    div.style.textAlign       = 'center';
                    div.style.display         = 'inline-block';
                    subjectDiv.appendChild(div);
                }
                subjectDiv.appendChild(endDiv);
                return subjectDiv;
            }

            function getAminoColor(char){
                switch(char) {
                    case 'A':
                        return '#DBFA60';
                        break;
                    case 'C':
                        return '#F9FA60';
                        break;
                    case 'D':
                        return '#F9605F';
                        break;
                    case 'E':
                        return '#F9609C';
                        break;
                    case 'F':
                        return '#5FF99D';
                        break;
                    case 'G':
                        return '#F9BC5F';
                        break;
                    case 'H':
                        return '#609DF9';
                        break;
                    case 'I':
                        return '#99F95A';
                        break;
                    case 'K':
                        return '#A062FF';
                        break;
                    case 'L':
                        return '#7EF960';
                        break;
                    case 'M':
                        return '#63FF63';
                        break;
                    case 'N':
                        return '#D95DF9';
                        break;
                    case 'P':
                        return '#F9DA60';
                        break;
                    case 'Q':
                        return '#F955D8';
                        break;
                    case 'R':
                        return '#5360FB';
                        break;
                    case 'S':
                        return '#F97E60';
                        break;
                    case 'T':
                        return '#FFA563';
                        break;
                    case 'V':
                        return '#C0F86B';
                        break;
                    case 'W':
                        return '#FDD9F9';
                        break;
                    case 'Y':
                        return '#60F9DA';
                        break;
                    default:
                        return '#FFFFFF';
                }
            }
        }
});
