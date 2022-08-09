# npm commands

* `npm install`
* `npm run build`
* `npm run watch`

# minify

* `uglifyjs build/blasterjs.js -o build/blasterjs.min.js`
* `npm run build && uglifyjs build/blasterjs.js -o build/blasterjs.min.js`

# test demo

* `python -m http.server --cgi 8080`
    * http://localhost:8080/examples/demo_nucleotides.html
    * http://localhost:8080/examples/demo_nucleotides_text.html
    * http://localhost:8080/examples/demo_amino.html
