#!/usr/bin/env node
// Usage: node parse.js
//
// Script that creates index.html out of web/template.html and README.md.
//
// It is written in JS because this code used to be executed on the client side.
// To install the Node.js and npm run:
// $ sudo apt install nodejs npm  # On macOS use `brew install ...` instead.
//
// To install dependencies globally, run:
// $ npm install -g jsdom jquery showdown highlightjs@9.12.0
//
// If running on macOS and modules can't be found after installation add:
// export NODE_PATH=/usr/local/lib/node_modules
// to the ~/.bash_profile or ~/.bashrc file and run '$ bash'.
//
// To avoid problems with permissions and path variables, install modules
// into project's directory using:
// $ npm install jsdom jquery showdown highlightjs@9.12.0
//
// It is also advisable to add a Bash script into .git/hooks directory, that will
// run this script before every commit. It should be named 'pre-commit' and it
// should contain the following line: `./parse.js`.


const fs = require('fs');
const jsdom = require('jsdom');
const showdown  = require('showdown');
const hljs = require('highlightjs');


const TOC =
  '<br>' +
  '<h2 id="toc">Contents</h2>\n' +
  '<pre><code class="hljs bash" style="line-height: 1.3em;"><strong>ToC</strong> = {\n' +
  '    <strong><span class="hljs-string">\'1. Collections\'</span></strong>: [<a href="#list">List</a>, <a href="#dictionary">Dictionary</a>, <a href="#set">Set</a>, <a href="#tuple">Tuple</a>, <a href="#range">Range</a>, <a href="#enumerate">Enumerate</a>, <a href="#iterator">Iterator</a>, <a href="#generator">Generator</a>],\n' +
  '    <strong><span class="hljs-string">\'2. Types\'</span></strong>:       [<a href="#type">Type</a>, <a href="#string">String</a>, <a href="#regex">Regular_Exp</a>, <a href="#format">Format</a>, <a href="#numbers">Numbers</a>, <a href="#combinatorics">Combinatorics</a>, <a href="#datetime">Datetime</a>],\n' +
  '    <strong><span class="hljs-string">\'3. Syntax\'</span></strong>:      [<a href="#arguments">Args</a>, <a href="#inline">Inline</a>, <a href="#imports">Import</a>, <a href="#decorator">Decorator</a>, <a href="#class">Class</a>, <a href="#ducktypes">Duck_Types</a>, <a href="#enum">Enum</a>, <a href="#exceptions">Exception</a>],\n' +
  '    <strong><span class="hljs-string">\'4. System\'</span></strong>:      [<a href="#exit">Exit</a>, <a href="#print">Print</a>, <a href="#input">Input</a>, <a href="#commandlinearguments">Command_Line_Arguments</a>, <a href="#open">Open</a>, <a href="#paths">Path</a>, <a href="#oscommands">OS_Commands</a>],\n' +
  '    <strong><span class="hljs-string">\'5. Data\'</span></strong>:        [<a href="#json">JSON</a>, <a href="#pickle">Pickle</a>, <a href="#csv">CSV</a>, <a href="#sqlite">SQLite</a>, <a href="#bytes">Bytes</a>, <a href="#struct">Struct</a>, <a href="#array">Array</a>, <a href="#memoryview">Memory_View</a>, <a href="#deque">Deque</a>],\n' +
  '    <strong><span class="hljs-string">\'6. Advanced\'</span></strong>:    [<a href="#threading">Threading</a>, <a href="#operator">Operator</a>, <a href="#introspection">Introspection</a>, <a href="#metaprogramming">Metaprograming</a>, <a href="#eval">Eval</a>, <a href="#coroutines">Coroutine</a>],\n' +
  '    <strong><span class="hljs-string">\'7. Libraries\'</span></strong>:   [<a href="#progressbar">Progress_Bar</a>, <a href="#plot">Plot</a>, <a href="#table">Table</a>, <a href="#curses">Curses</a>, <a href="#logging">Logging</a>, <a href="#scraping">Scraping</a>, <a href="#web">Web</a>, <a href="#profiling">Profile</a>,\n' +
  '                       <a href="#numpy">NumPy</a>, <a href="#image">Image</a>, <a href="#audio">Audio</a>, <a href="#pygame">Games</a>, <a href="#pandas">Data</a>]\n' +
  '}\n' +
  '</code></pre>\n';

const LRU_CACHE =
  '<span class="hljs-keyword">from</span> functools <span class="hljs-keyword">import</span> lru_cache\n' +
  '\n' +
  '<span class="hljs-meta">@lru_cache(maxsize=None)</span>\n' +
  '<span class="hljs-function"><span class="hljs-keyword">def</span> <span class="hljs-title">fib</span><span class="hljs-params">(n)</span>:</span>\n' +
  '    <span class="hljs-keyword">return</span> n <span class="hljs-keyword">if</span> n &lt; <span class="hljs-number">2</span> <span class="hljs-keyword">else</span> fib(n-<span class="hljs-number">2</span>) + fib(n-<span class="hljs-number">1</span>)\n';

const REPR_USE_CASES =
  'print/str/repr([&lt;el&gt;])\n' +
  '<span class="hljs-string">f\'<span class="hljs-subst">{&lt;el&gt;!r}</span>\'</span>\n' +
  'Z = dataclasses.make_dataclass(<span class="hljs-string">\'Z\'</span>, [<span class="hljs-string">\'a\'</span>]); print/str/repr(Z(&lt;el&gt;))\n' +
  '<span class="hljs-meta">&gt;&gt;&gt; </span>&lt;el&gt;\n';

const CONSTRUCTOR_OVERLOADING =
  '<span class="hljs-class"><span class="hljs-keyword">class</span> &lt;<span class="hljs-title">name</span>&gt;:</span>\n' +
  '    <span class="hljs-function"><span class="hljs-keyword">def</span> <span class="hljs-title">__init__</span><span class="hljs-params">(self, a=<span class="hljs-keyword">None</span>)</span>:</span>\n' +
  '        self.a = a\n';

const DATACLASS =
  '<span class="hljs-keyword">from</span> dataclasses <span class="hljs-keyword">import</span> make_dataclass\n' +
  '&lt;class&gt; = make_dataclass(<span class="hljs-string">\'&lt;class_name&gt;\'</span>, &lt;coll_of_attribute_names&gt;)\n' +
  '&lt;class&gt; = make_dataclass(<span class="hljs-string">\'&lt;class_name&gt;\'</span>, &lt;coll_of_tuples&gt;)\n' +
  '&lt;tuple&gt; = (<span class="hljs-string">\'&lt;attr_name&gt;\'</span>, &lt;type&gt; [, &lt;default_value&gt;])';

const SHUTIL_COPY =
  'shutil.copy(from, to)               <span class="hljs-comment"># Copies the file. \'to\' can exist or be a dir.</span>\n' +
  'shutil.copytree(from, to)           <span class="hljs-comment"># Copies the directory. \'to\' must not exist.</span>\n';

const OS_RENAME =
  'os.rename(from, to)                 <span class="hljs-comment"># Renames/moves the file or directory.</span>\n' +
  'os.replace(from, to)                <span class="hljs-comment"># Same, but overwrites \'to\' if it exists.</span>\n';

const TYPE =
  '&lt;class&gt; = type(<span class="hljs-string">\'&lt;class_name&gt;\'</span>, &lt;tuple_of_parents&gt;, &lt;dict_of_class_attributes&gt;)';

const EVAL =
  '<span class="hljs-meta">&gt;&gt;&gt; </span><span class="hljs-keyword">from</span> ast <span class="hljs-keyword">import</span> literal_eval\n' +
  '<span class="hljs-meta">&gt;&gt;&gt; </span>literal_eval(<span class="hljs-string">\'[1, 2, 3]\'</span>)\n' +
  '[<span class="hljs-number">1</span>, <span class="hljs-number">2</span>, <span class="hljs-number">3</span>]\n' +
  '<span class="hljs-meta">&gt;&gt;&gt; </span>literal_eval(<span class="hljs-string">\'1 + 2\'</span>)\n' +
  'ValueError: malformed node or string\n';

const PROGRESS_BAR =
  '<span class="hljs-comment"># $ pip3 install tqdm</span>\n' +
  '<span class="hljs-meta">&gt;&gt;&gt; </span><span class="hljs-keyword">from</span> tqdm <span class="hljs-keyword">import</span> tqdm\n' +
  '<span class="hljs-meta">&gt;&gt;&gt; </span><span class="hljs-keyword">from</span> time <span class="hljs-keyword">import</span> sleep\n' +
  '<span class="hljs-meta">&gt;&gt;&gt; </span><span class="hljs-keyword">for</span> el <span class="hljs-keyword">in</span> tqdm([<span class="hljs-number">1</span>, <span class="hljs-number">2</span>, <span class="hljs-number">3</span>], desc=<span class="hljs-string">\'Processing\'</span>):\n' +
  '<span class="hljs-meta">... </span>    sleep(<span class="hljs-number">1</span>)\n' +
  'Processing: 100%|████████████████████| 3/3 [00:03&lt;00:00,  1.00s/it]\n';

const PYINSTALLER =
  '$ pip3 install pyinstaller\n' +
  '$ pyinstaller script.py                        <span class="hljs-comment"># Compiles into \'./dist/script\' directory.</span>\n' +
  '$ pyinstaller script.py --onefile              <span class="hljs-comment"># Compiles into \'./dist/script\' console app.</span>\n' +
  '$ pyinstaller script.py --windowed             <span class="hljs-comment"># Compiles into \'./dist/script\' windowed app.</span>\n' +
  '$ pyinstaller script.py --add-data \'&lt;path&gt;:.\'  <span class="hljs-comment"># Adds file to the root of the executable.</span>\n';

const INDEX =
  '<li><strong>Only available in the <a href="https://transactions.sendowl.com/products/78175486/4422834F/view">PDF</a>.</strong></li>\n' +
  '<li><strong>Ctrl+F / ⌘F is usually sufficient.</strong></li>\n' +
  '<li><strong>Searching <code class="python hljs"><span class="hljs-string">\'#&lt;title&gt;\'</span></code> will limit the search to the titles.</strong></li>\n';

//It's for second commit
const DIAGRAM_1_A =
  '+------------------+------------+------------+------------+\n' +
  '|                  |  Iterable  | Collection |  Sequence  |\n' +
  '+------------------+------------+------------+------------+\n';

// const DIAGRAM_1_B =
//   '┏━━━━━━━━━━━━━━━━━━┯━━━━━━━━━━━━┯━━━━━━━━━━━━┯━━━━━━━━━━━━┓\n' +
//   '┃                  │  Sequence  │ Collection │  Iterable  ┃\n' +
//   '┠──────────────────┼────────────┼────────────┼────────────┨\n' +
//   '┃ list, range, str │     ✓      │     ✓      │     ✓      ┃\n' +
//   '┃ dict, set        │            │     ✓      │     ✓      ┃\n' +
//   '┃ iter             │            │            │     ✓      ┃\n' +
//   '┗━━━━━━━━━━━━━━━━━━┷━━━━━━━━━━━━┷━━━━━━━━━━━━┷━━━━━━━━━━━━┛\n';

const DIAGRAM_1_B =
'┏━━━━━━━━━━━━━━━━━━┯━━━━━━━━━━━━┯━━━━━━━━━━━━┯━━━━━━━━━━━━┓\n' +
'┃                  │  Iterable  │ Collection │  Sequence  ┃\n' +
'┠──────────────────┼────────────┼────────────┼────────────┨\n' +
'┃ list, range, str │     ✓      │     ✓      │     ✓      ┃\n' +
'┃ dict, set        │     ✓      │     ✓      │            ┃\n' +
'┃ iter             │     ✓      │            │            ┃\n' +
'┗━━━━━━━━━━━━━━━━━━┷━━━━━━━━━━━━┷━━━━━━━━━━━━┷━━━━━━━━━━━━┛\n';

const DIAGRAM_2_A =
  '+--------------------+----------+----------+----------+----------+----------+\n' +
  '|                    |  Number  |  Complex |   Real   | Rational | Integral |\n' +
  '+--------------------+----------+----------+----------+----------+----------+\n';

// const DIAGRAM_2_B =
//   '┏━━━━━━━━━━━━━━━━━━━━┯━━━━━━━━━━┯━━━━━━━━━━┯━━━━━━━━━━┯━━━━━━━━━━┯━━━━━━━━━━┓\n' +
//   '┃                    │ Integral │ Rational │   Real   │ Complex  │  Number  ┃\n' +
//   '┠────────────────────┼──────────┼──────────┼──────────┼──────────┼──────────┨\n' +
//   '┃ int                │    ✓     │    ✓     │    ✓     │    ✓     │    ✓     ┃\n' +
//   '┃ fractions.Fraction │          │    ✓     │    ✓     │    ✓     │    ✓     ┃\n' +
//   '┃ float              │          │          │    ✓     │    ✓     │    ✓     ┃\n' +
//   '┃ complex            │          │          │          │    ✓     │    ✓     ┃\n' +
//   '┃ decimal.Decimal    │          │          │          │          │    ✓     ┃\n' +
//   '┗━━━━━━━━━━━━━━━━━━━━┷━━━━━━━━━━┷━━━━━━━━━━┷━━━━━━━━━━┷━━━━━━━━━━┷━━━━━━━━━━┛\n';

const DIAGRAM_2_B =
  '┏━━━━━━━━━━━━━━━━━━━━┯━━━━━━━━━━┯━━━━━━━━━━┯━━━━━━━━━━┯━━━━━━━━━━┯━━━━━━━━━━┓\n' +
  '┃                    │  Number  │  Complex │   Real   │ Rational │ Integral ┃\n' +
  '┠────────────────────┼──────────┼──────────┼──────────┼──────────┼──────────┨\n' +
  '┃ int                │    ✓     │    ✓     │    ✓     │    ✓     │    ✓     ┃\n' +
  '┃ fractions.Fraction │    ✓     │    ✓     │    ✓     │    ✓     │          ┃\n' +
  '┃ float              │    ✓     │    ✓     │    ✓     │          │          ┃\n' +
  '┃ complex            │    ✓     │    ✓     │          │          │          ┃\n' +
  '┃ decimal.Decimal    │    ✓     │          │          │          │          ┃\n' +
  '┗━━━━━━━━━━━━━━━━━━━━┷━━━━━━━━━━┷━━━━━━━━━━┷━━━━━━━━━━┷━━━━━━━━━━┷━━━━━━━━━━┛\n';

const DIAGRAM_3_A =
  '+---------------+----------+----------+----------+----------+----------+\n';

const DIAGRAM_3_B =
  '┏━━━━━━━━━━━━━━━┯━━━━━━━━━━┯━━━━━━━━━━┯━━━━━━━━━━┯━━━━━━━━━━┯━━━━━━━━━━┓\n' +
  '┃               │ [ !#$%…] │ [a-zA-Z] │  [¼½¾]   │  [²³¹]   │  [0-9]   ┃\n' +
  '┠───────────────┼──────────┼──────────┼──────────┼──────────┼──────────┨\n' +
  '┃ isprintable() │    ✓     │    ✓     │    ✓     │    ✓     │    ✓     ┃\n' +
  '┃ isalnum()     │          │    ✓     │    ✓     │    ✓     │    ✓     ┃\n' +
  '┃ isnumeric()   │          │          │    ✓     │    ✓     │    ✓     ┃\n' +
  '┃ isdigit()     │          │          │          │    ✓     │    ✓     ┃\n' +
  '┃ isdecimal()   │          │          │          │          │    ✓     ┃\n' +
  '┗━━━━━━━━━━━━━━━┷━━━━━━━━━━┷━━━━━━━━━━┷━━━━━━━━━━┷━━━━━━━━━━┷━━━━━━━━━━┛\n';

const DIAGRAM_4_A =
  "+--------------+----------------+----------------+----------------+----------------+\n" +
  "|              |    {<float>}   |   {<float>:f}  |   {<float>:e}  |   {<float>:%}  |\n" +
  "+--------------+----------------+----------------+----------------+----------------+\n";

const DIAGRAM_4_B =
  "┏━━━━━━━━━━━━━━┯━━━━━━━━━━━━━━━━┯━━━━━━━━━━━━━━━━┯━━━━━━━━━━━━━━━━┯━━━━━━━━━━━━━━━━┓\n" +
  "┃              │    {&lt;float&gt;}   │   {&lt;float&gt;:f}  │   {&lt;float&gt;:e}  │   {&lt;float&gt;:%}  ┃\n" +
  "┠──────────────┼────────────────┼────────────────┼────────────────┼────────────────┨\n" +
  "┃  0.000056789 │   '5.6789e-05' │    '0.000057'  │ '5.678900e-05' │    '0.005679%' ┃\n" +
  "┃  0.00056789  │   '0.00056789' │    '0.000568'  │ '5.678900e-04' │    '0.056789%' ┃\n" +
  "┃  0.0056789   │   '0.0056789'  │    '0.005679'  │ '5.678900e-03' │    '0.567890%' ┃\n" +
  "┃  0.056789    │   '0.056789'   │    '0.056789'  │ '5.678900e-02' │    '5.678900%' ┃\n" +
  "┃  0.56789     │   '0.56789'    │    '0.567890'  │ '5.678900e-01' │   '56.789000%' ┃\n" +
  "┃  5.6789      │   '5.6789'     │    '5.678900'  │ '5.678900e+00' │  '567.890000%' ┃\n" +
  "┃ 56.789       │  '56.789'      │   '56.789000'  │ '5.678900e+01' │ '5678.900000%' ┃\n" +
  "┗━━━━━━━━━━━━━━┷━━━━━━━━━━━━━━━━┷━━━━━━━━━━━━━━━━┷━━━━━━━━━━━━━━━━┷━━━━━━━━━━━━━━━━┛\n" +
  "\n" +
  "┏━━━━━━━━━━━━━━┯━━━━━━━━━━━━━━━━┯━━━━━━━━━━━━━━━━┯━━━━━━━━━━━━━━━━┯━━━━━━━━━━━━━━━━┓\n" +
  "┃              │  {&lt;float&gt;:.2}  │  {&lt;float&gt;:.2f} │  {&lt;float&gt;:.2e} │  {&lt;float&gt;:.2%} ┃\n" +
  "┠──────────────┼────────────────┼────────────────┼────────────────┼────────────────┨\n" +
  "┃  0.000056789 │    '5.7e-05'   │      '0.00'    │   '5.68e-05'   │      '0.01%'   ┃\n" +
  "┃  0.00056789  │    '0.00057'   │      '0.00'    │   '5.68e-04'   │      '0.06%'   ┃\n" +
  "┃  0.0056789   │    '0.0057'    │      '0.01'    │   '5.68e-03'   │      '0.57%'   ┃\n" +
  "┃  0.056789    │    '0.057'     │      '0.06'    │   '5.68e-02'   │      '5.68%'   ┃\n" +
  "┃  0.56789     │    '0.57'      │      '0.57'    │   '5.68e-01'   │     '56.79%'   ┃\n" +
  "┃  5.6789      │    '5.7'       │      '5.68'    │   '5.68e+00'   │    '567.89%'   ┃\n" +
  "┃ 56.789       │    '5.7e+01'   │     '56.79'    │   '5.68e+01'   │   '5678.90%'   ┃\n" +
  "┗━━━━━━━━━━━━━━┷━━━━━━━━━━━━━━━━┷━━━━━━━━━━━━━━━━┷━━━━━━━━━━━━━━━━┷━━━━━━━━━━━━━━━━┛\n";

const DIAGRAM_6_A =
  '+------------+------------+------------+------------+--------------+\n' +
  '|            |  Iterable  | Collection |  Sequence  | abc.Sequence |\n' +
  '+------------+------------+------------+------------+--------------+\n';

const DIAGRAM_6_B =
  '┏━━━━━━━━━━━━┯━━━━━━━━━━━━┯━━━━━━━━━━━━┯━━━━━━━━━━━━┯━━━━━━━━━━━━━━┓\n' +
  '┃            │  Iterable  │ Collection │  Sequence  │ abc.Sequence ┃\n' +
  '┠────────────┼────────────┼────────────┼────────────┼──────────────┨\n' +
  '┃ iter()     │     !      │     !      │     ✓      │      ✓       ┃\n' +
  '┃ contains() │     ✓      │     ✓      │     ✓      │      ✓       ┃\n' +
  '┃ len()      │            │     !      │     !      │      !       ┃\n' +
  '┃ getitem()  │            │            │     !      │      !       ┃\n' +
  '┃ reversed() │            │            │     ✓      │      ✓       ┃\n' +
  '┃ index()    │            │            │            │      ✓       ┃\n' +
  '┃ count()    │            │            │            │      ✓       ┃\n' +
  '┗━━━━━━━━━━━━┷━━━━━━━━━━━━┷━━━━━━━━━━━━┷━━━━━━━━━━━━┷━━━━━━━━━━━━━━┛\n';

const DIAGRAM_7_A =
  'BaseException\n' +
  ' +-- SystemExit';

const DIAGRAM_7_B =
  "BaseException\n" +
  " ├── SystemExit                   <span class='hljs-comment'># Raised by the sys.exit() function.</span>\n" +
  " ├── KeyboardInterrupt            <span class='hljs-comment'># Raised when the user hits the interrupt key (ctrl-c).</span>\n" +
  " └── Exception                    <span class='hljs-comment'># User-defined exceptions should be derived from this class.</span>\n" +
  "      ├── ArithmeticError         <span class='hljs-comment'># Base class for arithmetic errors.</span>\n" +
  "      │    └── ZeroDivisionError  <span class='hljs-comment'># Raised when dividing by zero.</span>\n" +
  "      ├── AttributeError          <span class='hljs-comment'># Raised when an attribute is missing.</span>\n" +
  "      ├── EOFError                <span class='hljs-comment'># Raised by input() when it hits end-of-file condition.</span>\n" +
  "      ├── LookupError             <span class='hljs-comment'># Raised when a look-up on a collection fails.</span>\n" +
  "      │    ├── IndexError         <span class='hljs-comment'># Raised when a sequence index is out of range.</span>\n" +
  "      │    └── KeyError           <span class='hljs-comment'># Raised when a dictionary key or set element is missing.</span>\n" +
  "      ├── NameError               <span class='hljs-comment'># Raised when an object is missing.</span>\n" +
  "      ├── OSError                 <span class='hljs-comment'># Errors such as “file not found” or “disk full” (see Open).</span>\n" +
  "      │    └── FileNotFoundError  <span class='hljs-comment'># When a file or directory is requested but doesn't exist.</span>\n" +
  "      ├── RuntimeError            <span class='hljs-comment'># Raised by errors that don't fall into other categories.</span>\n" +
  "      │    └── RecursionError     <span class='hljs-comment'># Raised when the maximum recursion depth is exceeded.</span>\n" +
  "      ├── StopIteration           <span class='hljs-comment'># Raised by next() when run on an empty iterator.</span>\n" +
  "      ├── TypeError               <span class='hljs-comment'># Raised when an argument is of wrong type.</span>\n" +
  "      └── ValueError              <span class='hljs-comment'># When an argument is of right type but inappropriate value.</span>\n" +
  "           └── UnicodeError       <span class='hljs-comment'># Raised when encoding/decoding strings to/from bytes fails.</span>\n";

const DIAGRAM_8_A =
  '+-----------+------------+------------+------------+\n' +
  '|           |    List    |    Set     |    Dict    |\n' +
  '+-----------+------------+------------+------------+\n';

const DIAGRAM_8_B =
  '┏━━━━━━━━━━━┯━━━━━━━━━━━━┯━━━━━━━━━━━━┯━━━━━━━━━━━━┓\n' +
  '┃           │    List    │    Set     │    Dict    ┃\n' +
  '┠───────────┼────────────┼────────────┼────────────┨\n' +
  '┃ getitem() │ IndexError │            │  KeyError  ┃\n' +
  '┃ pop()     │ IndexError │  KeyError  │  KeyError  ┃\n' +
  '┃ remove()  │ ValueError │  KeyError  │            ┃\n' +
  '┃ index()   │ ValueError │            │            ┃\n' +
  '┗━━━━━━━━━━━┷━━━━━━━━━━━━┷━━━━━━━━━━━━┷━━━━━━━━━━━━┛\n';

const DIAGRAM_9_A =
  '+------------------+--------------+--------------+--------------+\n' +
  '|                  |     excel    |   excel-tab  |     unix     |\n' +
  '+------------------+--------------+--------------+--------------+\n';

const DIAGRAM_9_B =
  "┏━━━━━━━━━━━━━━━━━━┯━━━━━━━━━━━━━━┯━━━━━━━━━━━━━━┯━━━━━━━━━━━━━━┓\n" +
  "┃                  │     excel    │   excel-tab  │     unix     ┃\n" +
  "┠──────────────────┼──────────────┼──────────────┼──────────────┨\n" +
  "┃ delimiter        │       ','    │      '\\t'    │       ','    ┃\n" +
  "┃ quotechar        │       '\"'    │       '\"'    │       '\"'    ┃\n" +
  "┃ doublequote      │      True    │      True    │      True    ┃\n" +
  "┃ skipinitialspace │     False    │     False    │     False    ┃\n" +
  "┃ lineterminator   │    '\\r\\n'    │    '\\r\\n'    │      '\\n'    ┃\n" +
  "┃ quoting          │         0    │         0    │         1    ┃\n" +
  "┃ escapechar       │      None    │      None    │      None    ┃\n" +
  "┗━━━━━━━━━━━━━━━━━━┷━━━━━━━━━━━━━━┷━━━━━━━━━━━━━━┷━━━━━━━━━━━━━━┛\n";

const DIAGRAM_10_A =
  '+-------------+-------------+\n' +
  '|   Classes   | Metaclasses |\n' +
  '+-------------+-------------|\n' +
  '|   MyClass --> MyMetaClass |\n';

const DIAGRAM_10_B =
  '┏━━━━━━━━━━━━━┯━━━━━━━━━━━━━┓\n' +
  '┃   Classes   │ Metaclasses ┃\n' +
  '┠─────────────┼─────────────┨\n' +
  '┃   MyClass ──→ MyMetaClass ┃\n' +
  '┃             │     ↓       ┃\n' +
  '┃    object ─────→ type ←╮  ┃\n' +
  '┃             │     ↑ ╰──╯  ┃\n' +
  '┃     str ──────────╯       ┃\n' +
  '┗━━━━━━━━━━━━━┷━━━━━━━━━━━━━┛\n';

const DIAGRAM_11_A =
  '+-------------+-------------+\n' +
  '|   Classes   | Metaclasses |\n' +
  '+-------------+-------------|\n' +
  '|   MyClass   | MyMetaClass |\n';

const DIAGRAM_11_B =
  '┏━━━━━━━━━━━━━┯━━━━━━━━━━━━━┓\n' +
  '┃   Classes   │ Metaclasses ┃\n' +
  '┠─────────────┼─────────────┨\n' +
  '┃   MyClass   │ MyMetaClass ┃\n' +
  '┃      ↓      │     ↓       ┃\n' +
  '┃    object ←───── type     ┃\n' +
  '┃      ↑      │             ┃\n' +
  '┃     str     │             ┃\n' +
  '┗━━━━━━━━━━━━━┷━━━━━━━━━━━━━┛\n';

const DIAGRAM_12_A =
  '+-----------+-------------+------+-------------+\n' +
  '| sampwidth |     min     | zero |     max     |\n' +
  '+-----------+-------------+------+-------------+\n';

const DIAGRAM_12_B =
  '┏━━━━━━━━━━━┯━━━━━━━━━━━━━┯━━━━━━┯━━━━━━━━━━━━━┓\n' +
  '┃ sampwidth │     min     │ zero │     max     ┃\n' +
  '┠───────────┼─────────────┼──────┼─────────────┨\n' +
  '┃     1     │           0 │  128 │         255 ┃\n' +
  '┃     2     │      -32768 │    0 │       32767 ┃\n' +
  '┃     3     │    -8388608 │    0 │     8388607 ┃\n' +
  '┃     4     │ -2147483648 │    0 │  2147483647 ┃\n' +
  '┗━━━━━━━━━━━┷━━━━━━━━━━━━━┷━━━━━━┷━━━━━━━━━━━━━┛\n';

const DIAGRAM_13_A =
  '| sr.apply(…)     |      3      |    sum  3   |     s  3      |';

const DIAGRAM_13_B =
  "┏━━━━━━━━━━━━━━━━━┯━━━━━━━━━━━━━┯━━━━━━━━━━━━━┯━━━━━━━━━━━━━━━┓\n" +
  "┃                 │    'sum'    │   ['sum']   │ {'s': 'sum'}  ┃\n" +
  "┠─────────────────┼─────────────┼─────────────┼───────────────┨\n" +
  "┃ sr.apply(…)     │      3      │    sum  3   │     s  3      ┃\n" +
  "┃ sr.agg(…)       │             │             │               ┃\n" +
  "┗━━━━━━━━━━━━━━━━━┷━━━━━━━━━━━━━┷━━━━━━━━━━━━━┷━━━━━━━━━━━━━━━┛\n" +
  "\n" +
  "┏━━━━━━━━━━━━━━━━━┯━━━━━━━━━━━━━┯━━━━━━━━━━━━━┯━━━━━━━━━━━━━━━┓\n" +
  "┃                 │    'rank'   │   ['rank']  │ {'r': 'rank'} ┃\n" +
  "┠─────────────────┼─────────────┼─────────────┼───────────────┨\n" +
  "┃ sr.apply(…)     │             │      rank   │               ┃\n" +
  "┃ sr.agg(…)       │     x  1    │   x     1   │    r  x  1    ┃\n" +
  "┃ sr.transform(…) │     y  2    │   y     2   │       y  2    ┃\n" +
  "┗━━━━━━━━━━━━━━━━━┷━━━━━━━━━━━━━┷━━━━━━━━━━━━━┷━━━━━━━━━━━━━━━┛\n";

const DIAGRAM_15_A =
  '+------------------------+---------------+------------+------------+--------------------------+';

const DIAGRAM_15_B =
  "┏━━━━━━━━━━━━━━━━━━━━━━━━┯━━━━━━━━━━━━━━━┯━━━━━━━━━━━━┯━━━━━━━━━━━━┯━━━━━━━━━━━━━━━━━━━━━━━━━━┓\n" +
  "┃                        │    'outer'    │   'inner'  │   'left'   │       Description        ┃\n" +
  "┠────────────────────────┼───────────────┼────────────┼────────────┼──────────────────────────┨\n" +
  "┃ l.merge(r, on='y',     │    x   y   z  │ x   y   z  │ x   y   z  │ Joins/merges on column.  ┃\n" +
  "┃            how=…)      │ 0  1   2   .  │ 3   4   5  │ 1   2   .  │ Also accepts left_on and ┃\n" +
  "┃                        │ 1  3   4   5  │            │ 3   4   5  │ right_on parameters.     ┃\n" +
  "┃                        │ 2  .   6   7  │            │            │ Uses 'inner' by default. ┃\n" +
  "┠────────────────────────┼───────────────┼────────────┼────────────┼──────────────────────────┨\n" +
  "┃ l.join(r, lsuffix='l', │    x yl yr  z │            │ x yl yr  z │ Joins/merges on row keys.┃\n" +
  "┃           rsuffix='r', │ a  1  2  .  . │ x yl yr  z │ 1  2  .  . │ Uses 'left' by default.  ┃\n" +
  "┃           how=…)       │ b  3  4  4  5 │ 3  4  4  5 │ 3  4  4  5 │ If r is a series, it is  ┃\n" +
  "┃                        │ c  .  .  6  7 │            │            │ treated as a column.     ┃\n" +
  "┠────────────────────────┼───────────────┼────────────┼────────────┼──────────────────────────┨\n" +
  "┃ pd.concat([l, r],      │    x   y   z  │     y      │            │ Adds rows at the bottom. ┃\n" +
  "┃           axis=0,      │ a  1   2   .  │     2      │            │ Uses 'outer' by default. ┃\n" +
  "┃           join=…)      │ b  3   4   .  │     4      │            │ A series is treated as a ┃\n" +
  "┃                        │ b  .   4   5  │     4      │            │ column. Use l.append(sr) ┃\n" +
  "┃                        │ c  .   6   7  │     6      │            │ to add a row instead.    ┃\n" +
  "┠────────────────────────┼───────────────┼────────────┼────────────┼──────────────────────────┨\n" +
  "┃ pd.concat([l, r],      │    x  y  y  z │            │            │ Adds columns at the      ┃\n" +
  "┃           axis=1,      │ a  1  2  .  . │ x  y  y  z │            │ right end. Uses 'outer'  ┃\n" +
  "┃           join=…)      │ b  3  4  4  5 │ 3  4  4  5 │            │ by default. A series is  ┃\n" +
  "┃                        │ c  .  .  6  7 │            │            │ treated as a column.     ┃\n" +
  "┠────────────────────────┼───────────────┼────────────┼────────────┼──────────────────────────┨\n" +
  "┃ l.combine_first(r)     │    x   y   z  │            │            │ Adds missing rows and    ┃\n" +
  "┃                        │ a  1   2   .  │            │            │ columns. Also updates    ┃\n" +
  "┃                        │ b  3   4   5  │            │            │ items that contain NaN.  ┃\n" +
  "┃                        │ c  .   6   7  │            │            │ R must be a DataFrame.   ┃\n" +
  "┗━━━━━━━━━━━━━━━━━━━━━━━━┷━━━━━━━━━━━━━━━┷━━━━━━━━━━━━┷━━━━━━━━━━━━┷━━━━━━━━━━━━━━━━━━━━━━━━━━┛\n";

const DIAGRAM_16_A =
  '| df.apply(…)     |             |       x  y  |               |';

const DIAGRAM_16_B =
  "┏━━━━━━━━━━━━━━━━━┯━━━━━━━━━━━━━┯━━━━━━━━━━━━━┯━━━━━━━━━━━━━━━┓\n" +
  "┃                 │    'sum'    │   ['sum']   │ {'x': 'sum'}  ┃\n" +
  "┠─────────────────┼─────────────┼─────────────┼───────────────┨\n" +
  "┃ df.apply(…)     │             │       x  y  │               ┃\n" +
  "┃ df.agg(…)       │     x  4    │  sum  4  6  │     x  4      ┃\n" +
  "┃                 │     y  6    │             │               ┃\n" +
  "┗━━━━━━━━━━━━━━━━━┷━━━━━━━━━━━━━┷━━━━━━━━━━━━━┷━━━━━━━━━━━━━━━┛\n" +
  "\n" +
  "┏━━━━━━━━━━━━━━━━━┯━━━━━━━━━━━━━┯━━━━━━━━━━━━━┯━━━━━━━━━━━━━━━┓\n" +
  "┃                 │    'rank'   │   ['rank']  │ {'x': 'rank'} ┃\n" +
  "┠─────────────────┼─────────────┼─────────────┼───────────────┨\n" +
  "┃ df.apply(…)     │      x  y   │      x    y │        x      ┃\n" +
  "┃ df.agg(…)       │   a  1  1   │   rank rank │     a  1      ┃\n" +
  "┃ df.transform(…) │   b  2  2   │ a    1    1 │     b  2      ┃\n" +
  "┃                 │             │ b    2    2 │               ┃\n" +
  "┗━━━━━━━━━━━━━━━━━┷━━━━━━━━━━━━━┷━━━━━━━━━━━━━┷━━━━━━━━━━━━━━━┛\n";

const DIAGRAM_18_A =
  '| gb.agg(…)       |      x   y  |      x  y   |      x    y |        x      |';

const DIAGRAM_18_B =
  "┏━━━━━━━━━━━━━━━━━┯━━━━━━━━━━━━━┯━━━━━━━━━━━━━┯━━━━━━━━━━━━━┯━━━━━━━━━━━━━━━┓\n" +
  "┃                 │    'sum'    │    'rank'   │   ['rank']  │ {'x': 'rank'} ┃\n" +
  "┠─────────────────┼─────────────┼─────────────┼─────────────┼───────────────┨\n" +
  "┃ gb.agg(…)       │      x   y  │      x  y   │      x    y │        x      ┃\n" +
  "┃                 │  z          │   a  1  1   │   rank rank │     a  1      ┃\n" +
  "┃                 │  3   1   2  │   b  1  1   │ a    1    1 │     b  1      ┃\n" +
  "┃                 │  6  11  13  │   c  2  2   │ b    1    1 │     c  2      ┃\n" +
  "┃                 │             │             │ c    2    2 │               ┃\n" +
  "┠─────────────────┼─────────────┼─────────────┼─────────────┼───────────────┨\n" +
  "┃ gb.transform(…) │      x   y  │      x  y   │             │               ┃\n" +
  "┃                 │  a   1   2  │   a  1  1   │             │               ┃\n" +
  "┃                 │  b  11  13  │   b  1  1   │             │               ┃\n" +
  "┃                 │  c  11  13  │   c  2  2   │             │               ┃\n" +
  "┗━━━━━━━━━━━━━━━━━┷━━━━━━━━━━━━━┷━━━━━━━━━━━━━┷━━━━━━━━━━━━━┷━━━━━━━━━━━━━━━┛\n";


const MENU = '<a href="https://raw.githubusercontent.com/gto76/python-cheatsheet/main/README.md">Download text file</a>, <a href="https://transactions.sendowl.com/products/78175486/4422834F/view">Buy PDF</a>, <a href="https://github.com/gto76/python-cheatsheet">Fork me on GitHub</a>, <a href="https://github.com/gto76/python-cheatsheet/wiki/Frequently-Asked-Questions">Check out FAQ</a> or <a href="index.html?theme=dark3">Switch to dark theme</a>.\n';

const DARK_THEME_SCRIPT =
  '<script>\n' +
  '  // Changes the image and link to theme if URL ends with "index.html?theme=dark". \n' +
  '  if (window.location.search.search(/[?&]theme=dark/) !== -1) {\n' +
  '\n' +
  '    var link_to_theme = document.createElement("a")\n' +
  '    link_to_theme.href = "index.html"\n' +
  '    link_to_theme.text = "Switch to light theme"\n' +
  '    document.getElementsByClassName("banner")[0].firstChild.children[4].replaceWith(link_to_theme)\n' +
  '\n' +
  '    var img_dark = document.createElement("img");\n' +
  '    img_dark.src = "web/image_orig_blue6.png";\n' +
  '    img_dark.alt = "Monthy Python";\n' +
  '    if ((window.location.search.search(/[?&]theme=dark2/) !== -1) ||\n' +
  '        (window.location.search.search(/[?&]theme=dark3/) !== -1)) {\n' +
  '      img_dark.style = "width: 910px;";\n' +
  '    } else {\n' +
  '      img_dark.style = "width: 960px;";\n' +
  '    }\n' +
  '    document.getElementsByClassName("banner")[1].firstChild.replaceWith(img_dark);\n' +
  '  }\n' +
  '</script>';


function main() {
  const html = getMd();
  initDom(html);
  modifyPage();
  var template = readFile('web/template.html');
  template = updateDate(template);
  const tokens = template.split('<div id=main_container></div>');
  const text = `${tokens[0]} ${document.body.innerHTML} ${tokens[1]}`;
  writeToFile('index.html', text);
}

function getMd() {
  var readme = readFile('README.md');
  var readme = readme.replace("#semaphore-event-barrier", "#semaphoreeventbarrier");
  var readme = readme.replace("#semaphore-event-barrier", "#semaphoreeventbarrier");
  var readme = readme.replace("#dataframe-plot-encode-decode", "#dataframeplotencodedecode");
  const converter = new showdown.Converter();
  return converter.makeHtml(readme);
}

function initDom(html) {
  const { JSDOM } = jsdom;
  const dom = new JSDOM(html);
  const $ = (require('jquery'))(dom.window);
  global.$ = $;
  global.document = dom.window.document;
}

function modifyPage() {
  changeMenu();
  addDarkThemeScript();
  removeOrigToc();
  addToc();
  insertLinks();
  unindentBanner();
  updateDiagrams();
  highlightCode();
  fixPandasDiagram();
  removePlotImages();
  fixABCSequenceDiv();
}

function changeMenu() {
  $('sup').first().html(MENU)
}

function addDarkThemeScript() {
  $('#main').before(DARK_THEME_SCRIPT);
}

function removeOrigToc() {
  const headerContents = $('#contents');
  const contentsList = headerContents.next();
  headerContents.remove();
  contentsList.remove();
}

function addToc() {
  const nodes = $.parseHTML(TOC);
  $('#main').before(nodes);
}

function insertLinks() {
  $('h2').each(function() {
    const aId = $(this).attr('id');
    const text = $(this).text();
    const line = `<a href="#${aId}" name="${aId}">#</a>${text}`;
    $(this).html(line);
  });
}

function unindentBanner() {
  const montyImg = $('img').first();
  montyImg.parent().addClass('banner');
  const downloadPraragrapth = $('p').first();
  downloadPraragrapth.addClass('banner');
}

function updateDiagrams() {
  $(`code:contains(${DIAGRAM_1_A})`).html(DIAGRAM_1_B);
  $(`code:contains(${DIAGRAM_2_A})`).html(DIAGRAM_2_B);
  $(`code:contains(${DIAGRAM_3_A})`).html(DIAGRAM_3_B);
  $(`code:contains(${DIAGRAM_4_A})`).html(DIAGRAM_4_B);
  $(`code:contains(${DIAGRAM_6_A})`).html(DIAGRAM_6_B);
  $(`code:contains(${DIAGRAM_7_A})`).html(DIAGRAM_7_B);
  $(`code:contains(${DIAGRAM_8_A})`).html(DIAGRAM_8_B);
  $(`code:contains(${DIAGRAM_9_A})`).html(DIAGRAM_9_B);
  $(`code:contains(${DIAGRAM_10_A})`).html(DIAGRAM_10_B);
  $(`code:contains(${DIAGRAM_11_A})`).html(DIAGRAM_11_B);
  $(`code:contains(${DIAGRAM_12_A})`).html(DIAGRAM_12_B).removeClass("text").removeClass("language-text").addClass("python");
  $(`code:contains(${DIAGRAM_13_A})`).html(DIAGRAM_13_B).removeClass("text").removeClass("language-text").addClass("python");
  $(`code:contains(${DIAGRAM_15_A})`).html(DIAGRAM_15_B).removeClass("text").removeClass("language-text").addClass("python");
  $(`code:contains(${DIAGRAM_16_A})`).html(DIAGRAM_16_B).removeClass("text").removeClass("language-text").addClass("python");
  $(`code:contains(${DIAGRAM_18_A})`).html(DIAGRAM_18_B).removeClass("text").removeClass("language-text").addClass("python");
}

function highlightCode() {
  setApaches(['<D>', '<T>', '<DT>', '<TD>', '<a>', '<n>']);
  $('code').not('.python').not('.text').not('.bash').not('.apache').addClass('python');
  $('code').each(function(index) {
      hljs.highlightBlock(this);
  });
  fixClasses();
  fixHighlights();
  preventPageBreaks();
  fixPageBreaksFile();
  fixPageBreaksStruct();
  insertPageBreaks();
}

function setApaches(elements) {
  for (el of elements) {
    $(`code:contains(${el})`).addClass('apache');
  }
}

function fixClasses() {
  // Changes class="hljs-keyword" to class="hljs-title" of 'class' keyword.
  $('.hljs-class').filter(':contains(class \')').find(':first-child').removeClass('hljs-keyword').addClass('hljs-title')
}

function fixHighlights() {
  $(`code:contains(@lru_cache(maxsize=None))`).html(LRU_CACHE);
  $(`code:contains((self, a=None):)`).html(CONSTRUCTOR_OVERLOADING);
  $(`code:contains(print/str/repr([<el>]))`).html(REPR_USE_CASES);
  $(`code:contains(make_dataclass(\'<class_name>\')`).html(DATACLASS);
  $(`code:contains(shutil.copy)`).html(SHUTIL_COPY);
  $(`code:contains(os.rename)`).html(OS_RENAME);
  $(`code:contains(\'<class_name>\', <tuple_of_parents>, <dict_of_class_attributes>)`).html(TYPE);
  $(`code:contains(ValueError: malformed node)`).html(EVAL);
  $(`code:contains(pip3 install tqdm)`).html(PROGRESS_BAR);
  $(`code:contains(pip3 install pyinstaller)`).html(PYINSTALLER);
  $(`ul:contains(Only available in)`).html(INDEX);
}

function preventPageBreaks() {
  $(':header').each(function(index) {
    var el = $(this)
    var untilPre = el.nextUntil('pre')
    var untilH2 = el.nextUntil('h2')
    if ((untilPre.length < untilH2.length) || el.prop('tagName') === 'H1') {
      untilPre.add(el).next().add(el).wrapAll("<div></div>");
    } else {
      untilH2.add(el).wrapAll("<div></div>");
    }
  });
}

function fixPageBreaksFile() {
  const modesDiv = $('#file').parent().parent().parent()
  move(modesDiv, 'file')
  move(modesDiv, 'exceptions-1')
}

function fixPageBreaksStruct() {
  const formatDiv = $('#floatingpointtypes').parent().parent().parent().parent()
  move(formatDiv, 'floatingpointtypes')
  move(formatDiv, 'integertypesuseacapitalletterforunsignedtypeminimumandstandardsizesareinbrackets')
  move(formatDiv, 'forstandardsizesstartformatstringwith')
}

function move(anchor_el, el_id) {
  const el = $('#'+el_id).parent()
  anchor_el.after(el)
}

function insertPageBreaks() {
  insertPageBreakBefore('#decorator')
  // insertPageBreakBefore('#print')
}

function insertPageBreakBefore(an_id) {
  $('<div class="pagebreak"></div>').insertBefore($(an_id).parent())
}

function fixPandasDiagram() {
  const diagram_15 = '┏━━━━━━━━━━━━━━━━━━━━━━━━┯━━━━━━━━━━━━━━━┯━━━━━━━━━━━━┯━━━━━━━━━━━━┯━━━━━━━━━━━━━━━━━━━━━━━━━━┓';
  $(`code:contains(${diagram_15})`).find(".hljs-keyword:contains(and)").after("and");
  $(`code:contains(${diagram_15})`).find(".hljs-keyword:contains(as)").after("as");
  $(`code:contains(${diagram_15})`).find(".hljs-keyword:contains(is)").after("is");
  $(`code:contains(${diagram_15})`).find(".hljs-keyword").remove();
}

function removePlotImages() {
  $('img[alt="Covid Deaths"]').remove();
  $('img[alt="Covid Cases"]').remove();
}

function fixABCSequenceDiv() {
  $('#abcsequence').parent().insertBefore($('#tableofrequiredandautomaticallyavailablespecialmethods').parent())
}

function updateDate(template) {
  const date = new Date();
  const date_str = date.toLocaleString('en-us', {month: 'long', day: 'numeric', year: 'numeric'});
  template = template.replace('May 20, 2021', date_str);
  template = template.replace('May 20, 2021', date_str);
  return template;
}


// UTIL

function readFile(filename) {
  try {  
    return fs.readFileSync(filename, 'utf8');
  } catch(e) {
    console.error('Error:', e.stack);
  }
}

function writeToFile(filename, text) {
  try {  
    return fs.writeFileSync(filename, text, 'utf8');
  } catch(e) {
    console.error('Error:', e.stack);
  }
}

main();
