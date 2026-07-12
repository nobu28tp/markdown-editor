const mermaid = require('mermaid');

const md = `graph BT
    Base["ステークホルダーとの「協業」<br>エリアデータの「利活用」"]
    Protect(["地域の生活を守る"])
    Improve(["より良い生活をつくる"])
    Earn(["地域で稼ぐ力をつける"])

    Base --> Protect
    Base --> Improve
    Base --> Earn

    classDef baseClass fill:#0033cc,color:#fff,stroke:none;
    classDef goalClass fill:#fff,color:#000,stroke:#e6f0ff,stroke-width:3px;
    
    class Base baseClass;
    class Protect,Improve,Earn goalClass;`;

console.log("Testing Mermaid classDef parsing without full rendering... wait, mermaid needs DOM.");
