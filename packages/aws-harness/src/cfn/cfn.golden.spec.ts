import { describe, expect, it } from "vitest";
import { dependencyOrder, securityIssues, validateTemplate } from "./index.js";

describe("cfn: casos dorados de la guía de usuario y la referencia de plantillas de AWS CloudFormation", () => {
  // Fuente: https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/resources-section-structure.html
  it("el ejemplo de un único recurso con nombre personalizado es válido y no declara bloqueo público", () => {
    const template = {
      Resources: { MyBucket: { Type: "AWS::S3::Bucket", Properties: { BucketName: "amzn-s3-demo-bucket" } } },
    };
    expect(validateTemplate(template)).toEqual([]);
    expect(dependencyOrder(template)).toEqual(["MyBucket"]);
    expect(securityIssues(template, [{ type: "s3-no-public-access-block" }])).toEqual([
      {
        path: "Resources.MyBucket.Properties.PublicAccessBlockConfiguration",
        message: "El bucket «MyBucket» no declara PublicAccessBlockConfiguration.",
      },
    ]);
  });

  // Fuente: https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/resources-section-structure.html
  it("el ejemplo de Ref entre una instancia y su grupo de seguridad ordena el grupo primero y marca el puerto 22 abierto", () => {
    const template = {
      Resources: {
        Ec2Instance: {
          Type: "AWS::EC2::Instance",
          Properties: {
            SecurityGroupIds: [{ Ref: "InstanceSecurityGroup" }, "sg-12a4c434"],
            KeyName: "MyKey",
            ImageId: "ami-1234567890abcdef0",
          },
        },
        InstanceSecurityGroup: {
          Type: "AWS::EC2::SecurityGroup",
          Properties: {
            GroupDescription: "Enable SSH access via port 22",
            SecurityGroupIngress: [{ IpProtocol: "tcp", FromPort: 22, ToPort: 22, CidrIp: "0.0.0.0/0" }],
          },
        },
      },
    };
    expect(validateTemplate(template)).toEqual([]);
    expect(dependencyOrder(template)).toEqual(["InstanceSecurityGroup", "Ec2Instance"]);
    expect(securityIssues(template, [{ type: "sg-open-ingress", port: 22 }])).toEqual([
      {
        path: "Resources.InstanceSecurityGroup.Properties.SecurityGroupIngress[0]",
        message: "El grupo de seguridad «InstanceSecurityGroup» permite el ingreso desde 0.0.0.0/0 al puerto 22.",
      },
    ]);
    expect(securityIssues(template, [{ type: "sg-open-ingress", port: 80 }])).toEqual([]);
  });

  // Fuente: https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/intrinsic-function-reference-getatt.html
  it("el ejemplo de Fn::GetAtt con SourceSecurityGroup.OwnerAlias hacia el balanceador myELB es válido", () => {
    const template = {
      AWSTemplateFormatVersion: "2010-09-09",
      Resources: {
        myELB: {
          Type: "AWS::ElasticLoadBalancing::LoadBalancer",
          Properties: {
            AvailabilityZones: ["eu-west-1a"],
            Listeners: [{ LoadBalancerPort: "80", InstancePort: "80", Protocol: "HTTP" }],
          },
        },
        myELBIngressGroup: {
          Type: "AWS::EC2::SecurityGroup",
          Properties: {
            GroupDescription: "ELB ingress group",
            SecurityGroupIngress: [
              {
                IpProtocol: "tcp",
                FromPort: 80,
                ToPort: 80,
                SourceSecurityGroupOwnerId: { "Fn::GetAtt": ["myELB", "SourceSecurityGroup.OwnerAlias"] },
                SourceSecurityGroupName: { "Fn::GetAtt": ["myELB", "SourceSecurityGroup.GroupName"] },
              },
            ],
          },
        },
      },
    };
    expect(validateTemplate(template)).toEqual([]);
    expect(dependencyOrder(template)).toEqual(["myELB", "myELBIngressGroup"]);
    expect(securityIssues(template, [{ type: "sg-open-ingress", port: 80 }])).toEqual([]);
  });

  // Fuente: https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/intrinsic-function-reference-getatt.html
  it("un Fn::GetAtt hacia un recurso que no existe se informa", () => {
    const template = {
      Resources: {
        Sg: {
          Type: "AWS::EC2::SecurityGroup",
          Properties: { GroupDescription: { "Fn::GetAtt": ["myELB", "DNSName"] } },
        },
      },
    };
    expect(validateTemplate(template)).toEqual([
      {
        path: "Resources.Sg.Properties.GroupDescription.Fn::GetAtt",
        message: "Fn::GetAtt apunta al recurso «myELB», que no existe en la plantilla.",
      },
    ]);
  });

  // Fuente: https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/intrinsic-function-reference-sub.html
  it("Fn::Sub sin mapa con el pseudoparámetro AWS::StackName es válido", () => {
    const template = {
      Resources: {
        InstanceSecurityGroup: {
          Type: "AWS::EC2::SecurityGroup",
          Properties: { GroupDescription: { "Fn::Sub": "SSH security group for ${AWS::StackName}" } },
        },
      },
    };
    expect(validateTemplate(template)).toEqual([]);
  });

  // Fuente: https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/intrinsic-function-reference-sub.html
  it("Fn::Sub con mapa www.${Domain} y Ref al parámetro RootDomainName es válido; sin mapa, la variable se informa", () => {
    const withMap = {
      Parameters: { RootDomainName: { Type: "String" } },
      Resources: {
        WWWBucket: {
          Type: "AWS::S3::Bucket",
          Properties: { BucketName: { "Fn::Sub": ["www.${Domain}", { Domain: { Ref: "RootDomainName" } }] } },
        },
      },
    };
    expect(validateTemplate(withMap)).toEqual([]);
    const withoutMap = {
      Parameters: { RootDomainName: { Type: "String" } },
      Resources: {
        WWWBucket: { Type: "AWS::S3::Bucket", Properties: { BucketName: { "Fn::Sub": "www.${Domain}" } } },
      },
    };
    expect(validateTemplate(withoutMap)).toHaveLength(1);
  });

  // Fuente: https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/intrinsic-function-reference-sub.html
  it("Fn::Sub del ARN de una VPC con AWS::Region, AWS::AccountId y el recurso vpc crea la dependencia", () => {
    const vpc = { Type: "AWS::EC2::VPC", Properties: { CidrBlock: "10.0.0.0/16" } };
    const topic = {
      Type: "AWS::SNS::Topic",
      Properties: { DisplayName: { "Fn::Sub": "arn:aws:ec2:${AWS::Region}:${AWS::AccountId}:vpc/${vpc}" } },
    };
    expect(validateTemplate({ Resources: { vpc, Topic: topic } })).toEqual([]);
    expect(dependencyOrder({ Resources: { Topic: topic, vpc } })).toEqual(["vpc", "Topic"]);
  });

  // Fuente: https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/intrinsic-function-reference-sub.html
  it("la forma ${!Literal} no es una variable", () => {
    const template = {
      Resources: {
        Topic: { Type: "AWS::SNS::Topic", Properties: { DisplayName: { "Fn::Sub": "texto ${!Literal}" } } },
      },
    };
    expect(validateTemplate(template)).toEqual([]);
  });

  // Fuente: https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/pseudo-parameter-reference.html
  it("el ejemplo básico de pseudoparámetros (tema SNS y alarma de CloudWatch) es válido y el tema va primero", () => {
    const template = {
      Resources: {
        MyNotificationTopic: {
          Type: "AWS::SNS::Topic",
          Properties: { DisplayName: { "Fn::Sub": "Notifications for ${AWS::StackName}" } },
        },
        CPUAlarm: {
          Type: "AWS::CloudWatch::Alarm",
          Properties: {
            AlarmDescription: { "Fn::Sub": "Alarm for high CPU in ${AWS::Region}" },
            AlarmName: { "Fn::Sub": "${AWS::StackName}-HighCPUAlarm" },
            MetricName: "CPUUtilization",
            Namespace: "AWS/EC2",
            Statistic: "Average",
            Period: 300,
            EvaluationPeriods: 1,
            Threshold: 80,
            ComparisonOperator: "GreaterThanThreshold",
            AlarmActions: [{ "Fn::Sub": "arn:aws:sns:${AWS::Region}:${AWS::AccountId}:${MyNotificationTopic}" }],
          },
        },
      },
    };
    expect(validateTemplate(template)).toEqual([]);
    expect(dependencyOrder(template)).toEqual(["MyNotificationTopic", "CPUAlarm"]);
  });

  // Fuente: https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/pseudo-parameter-reference.html
  it("un pseudoparámetro que la guía no lista (AWS::Foo) se informa", () => {
    const template = {
      Resources: { Topic: { Type: "AWS::SNS::Topic", Properties: { DisplayName: { Ref: "AWS::Foo" } } } },
    };
    expect(validateTemplate(template)).toEqual([
      {
        path: "Resources.Topic.Properties.DisplayName.Ref",
        message: "Ref apunta a «AWS::Foo», que no es un parámetro, un recurso ni un pseudoparámetro de la plantilla.",
      },
    ]);
  });

  // Fuente: https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/aws-attribute-dependson.html
  it("el ejemplo de DependsOn crea myDB antes que Ec2Instance", () => {
    const template = {
      Resources: {
        Ec2Instance: {
          Type: "AWS::EC2::Instance",
          Properties: {
            ImageId: "{{resolve:ssm:/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-6.1-x86_64}}",
            InstanceType: "t2.micro",
          },
          DependsOn: "myDB",
        },
        myDB: {
          Type: "AWS::RDS::DBInstance",
          Properties: {
            AllocatedStorage: "5",
            DBInstanceClass: "db.t2.small",
            Engine: "MySQL",
            EngineVersion: "5.5",
            MasterUsername: "{{resolve:secretsmanager:MySecret:SecretString:username}}",
            MasterUserPassword: "{{resolve:secretsmanager:MySecret:SecretString:password}}",
          },
        },
      },
    };
    expect(validateTemplate(template)).toEqual([]);
    expect(dependencyOrder(template)).toEqual(["myDB", "Ec2Instance"]);
  });

  // Fuente: https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/aws-attribute-dependson.html
  it("DependsOn acepta una lista y rechaza un recurso que no existe", () => {
    const ok = {
      Resources: {
        A: { Type: "AWS::SNS::Topic", DependsOn: ["B", "C"] },
        B: { Type: "AWS::SNS::Topic" },
        C: { Type: "AWS::SNS::Topic" },
      },
    };
    expect(dependencyOrder(ok)).toEqual(["B", "C", "A"]);
    const bad = { Resources: { A: { Type: "AWS::SNS::Topic", DependsOn: "Z" } } };
    expect(validateTemplate(bad)).toEqual([
      { path: "Resources.A.DependsOn", message: "DependsOn apunta a «Z», que no es un recurso de la plantilla." },
    ]);
  });

  // Fuente: https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/aws-attribute-dependson.html
  it("el ejemplo de la pasarela (GatewayToInternet) obliga a crear la asociación antes que el host", () => {
    const template = {
      Resources: {
        VPC: { Type: "AWS::EC2::VPC", Properties: { CidrBlock: "10.0.0.0/16" } },
        InternetGateway: { Type: "AWS::EC2::InternetGateway" },
        EC2Host: {
          Type: "AWS::EC2::Instance",
          DependsOn: "GatewayToInternet",
          Properties: { InstanceType: "t2.micro" },
        },
        GatewayToInternet: {
          Type: "AWS::EC2::VPCGatewayAttachment",
          Properties: { VpcId: { Ref: "VPC" }, InternetGatewayId: { Ref: "InternetGateway" } },
        },
      },
    };
    expect(validateTemplate(template)).toEqual([]);
    expect(dependencyOrder(template)).toEqual(["VPC", "InternetGateway", "GatewayToInternet", "EC2Host"]);
  });

  // Fuente: https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/intrinsic-function-reference-join.html
  it('Fn::Join con ":" y con Ref a AWS::Partition y AWS::AccountId es válido', () => {
    const template = {
      Resources: { Topic: { Type: "AWS::SNS::Topic" } },
      Outputs: {
        Simple: { Value: { "Fn::Join": [":", ["a", "b", "c"]] } },
        Arn: {
          Value: {
            "Fn::Join": ["", ["arn:", { Ref: "AWS::Partition" }, ":s3:::elasticbeanstalk-*-", { Ref: "AWS::AccountId" }]],
          },
        },
      },
    };
    expect(validateTemplate(template)).toEqual([]);
    const malformed = {
      Resources: { Topic: { Type: "AWS::SNS::Topic" } },
      Outputs: { Bad: { Value: { "Fn::Join": ["a"] } } },
    };
    expect(validateTemplate(malformed)).toEqual([
      { path: "Outputs.Bad.Value.Fn::Join", message: "Fn::Join debe ser una lista [delimitador, lista de valores]." },
    ]);
  });

  // Fuente: https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/outputs-section-structure.html
  it("el ejemplo de salidas (GetAtt de BackupLoadBalancer e InstanceID con Ref) es válido", () => {
    const template = {
      Resources: {
        BackupLoadBalancer: { Type: "AWS::ElasticLoadBalancing::LoadBalancer" },
        EC2Instance: { Type: "AWS::EC2::Instance" },
      },
      Outputs: {
        BackupLoadBalancerDNSName: {
          Description: "The DNSName of the backup load balancer",
          Value: { "Fn::GetAtt": ["BackupLoadBalancer", "DNSName"] },
          Condition: "CreateProdResources",
        },
        InstanceID: { Description: "The Instance ID", Value: { Ref: "EC2Instance" } },
      },
    };
    expect(validateTemplate(template)).toEqual([]);
  });

  // Fuente: https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/outputs-section-structure.html
  it("el atributo Value de una salida es obligatorio y Export necesita Name", () => {
    const template = {
      Resources: { Topic: { Type: "AWS::SNS::Topic" } },
      Outputs: { NoValue: { Description: "Sin valor" }, BadExport: { Value: "x", Export: {} } },
    };
    expect(validateTemplate(template)).toEqual([
      { path: "Outputs.NoValue.Value", message: "La salida «NoValue» necesita el atributo Value." },
      { path: "Outputs.BadExport.Export", message: "Export debe ser un objeto con el atributo Name." },
    ]);
  });

  // Fuente: https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/outputs-section-structure.html
  it("las salidas con Export.Name construido con Fn::Join o Fn::Sub y AWS::StackName son válidas", () => {
    const template = {
      Resources: { VPC: { Type: "AWS::EC2::VPC", Properties: { CidrBlock: "10.0.0.0/16" } } },
      Outputs: {
        StackVPC: {
          Description: "The ID of the VPC",
          Value: { Ref: "VPC" },
          Export: { Name: { "Fn::Join": [":", [{ Ref: "AWS::StackName" }, "VPCID"]] } },
        },
        StackVPCSub: { Value: { Ref: "VPC" }, Export: { Name: { "Fn::Sub": "${AWS::StackName}-VPCID" } } },
      },
    };
    expect(validateTemplate(template)).toEqual([]);
  });

  // Fuente: https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/parameters-section-structure.html
  it("el atributo Type de un parámetro es obligatorio", () => {
    const template = {
      Parameters: { KeyName: { Description: "Nombre de la clave" }, Env: { Type: "String", Default: "dev" } },
      Resources: { Topic: { Type: "AWS::SNS::Topic", Properties: { DisplayName: { Ref: "Env" } } } },
    };
    expect(validateTemplate(template)).toEqual([
      { path: "Parameters.KeyName.Type", message: "El parámetro «KeyName» necesita el atributo Type." },
    ]);
  });

  // Fuente: https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/format-version-structure.html
  it("2010-09-09 es el único valor válido de AWSTemplateFormatVersion", () => {
    const good = { AWSTemplateFormatVersion: "2010-09-09", Resources: { T: { Type: "AWS::SNS::Topic" } } };
    const bad = { AWSTemplateFormatVersion: "2011-01-01", Resources: { T: { Type: "AWS::SNS::Topic" } } };
    expect(validateTemplate(good)).toEqual([]);
    expect(validateTemplate(bad)).toEqual([
      {
        path: "AWSTemplateFormatVersion",
        message: "AWSTemplateFormatVersion debe ser el texto «2010-09-09», el único valor válido.",
      },
    ]);
  });

  // Fuente: https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/template-anatomy.html
  it("Resources es la única sección obligatoria; Parameters y Outputs son opcionales", () => {
    expect(validateTemplate({ Parameters: { P: { Type: "String" } } })).toEqual([
      { path: "Resources", message: "Falta la sección obligatoria «Resources»." },
    ]);
    expect(validateTemplate({ Resources: { T: { Type: "AWS::SNS::Topic" } } })).toEqual([]);
  });

  // Fuente: https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/resources-section-structure.html
  it("el nombre lógico debe ser alfanumérico y el tipo debe tener la forma AWS::ServicioNombre::TipoRecurso", () => {
    const template = { Resources: { "Mi-Bucket": { Type: "S3Bucket" } } };
    expect(validateTemplate(template)).toEqual([
      { path: "Resources.Mi-Bucket", message: "El nombre lógico «Mi-Bucket» debe ser alfanumérico (A-Za-z0-9)." },
      {
        path: "Resources.Mi-Bucket.Type",
        message: "El tipo «S3Bucket» no tiene la forma AWS::ServicioNombre::TipoRecurso.",
      },
    ]);
  });

  // Fuente: https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/aws-resource-ec2-securitygroup.html
  it("los ejemplos de ingreso y egreso (puerto 80 abierto) y de ping desde 10.0.0.0/24 con DependsOn", () => {
    const basic = {
      Resources: {
        myVPC: { Type: "AWS::EC2::VPC", Properties: { CidrBlock: "10.0.0.0/16" } },
        InstanceSecurityGroup: {
          Type: "AWS::EC2::SecurityGroup",
          Properties: {
            GroupDescription: "Allow http to client host",
            VpcId: { Ref: "myVPC" },
            SecurityGroupIngress: [{ IpProtocol: "tcp", FromPort: 80, ToPort: 80, CidrIp: "0.0.0.0/0" }],
            SecurityGroupEgress: [{ IpProtocol: "tcp", FromPort: 80, ToPort: 80, CidrIp: "0.0.0.0/0" }],
          },
        },
      },
    };
    expect(validateTemplate(basic)).toEqual([]);
    expect(securityIssues(basic, [{ type: "sg-open-ingress", port: 80 }])).toHaveLength(1);
    expect(securityIssues(basic, [{ type: "sg-open-ingress", port: 443 }])).toEqual([]);
    const ping = {
      Resources: {
        VPC: { Type: "AWS::EC2::VPC", Properties: { CidrBlock: "10.0.0.0/16" } },
        SGPing: {
          Type: "AWS::EC2::SecurityGroup",
          DependsOn: "VPC",
          Properties: {
            GroupDescription: "SG to test ping",
            VpcId: { Ref: "VPC" },
            SecurityGroupIngress: [
              { IpProtocol: "tcp", FromPort: 22, ToPort: 22, CidrIp: "10.0.0.0/24" },
              { IpProtocol: "icmp", FromPort: 8, ToPort: -1, CidrIp: "10.0.0.0/24" },
            ],
          },
        },
      },
    };
    expect(validateTemplate(ping)).toEqual([]);
    expect(securityIssues(ping, [{ type: "sg-open-ingress", port: 22 }])).toEqual([]);
  });

  // Fuente: https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/aws-properties-ec2-securitygroup-ingress.html
  it("IpProtocol -1 permite todos los puertos, sea cual sea el rango", () => {
    const template = {
      Resources: {
        Sg: {
          Type: "AWS::EC2::SecurityGroup",
          Properties: { GroupDescription: "Todo", SecurityGroupIngress: [{ IpProtocol: "-1", CidrIp: "0.0.0.0/0" }] },
        },
      },
    };
    expect(securityIssues(template, [{ type: "sg-open-ingress", port: 3306 }])).toHaveLength(1);
  });

  // Fuente: https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/aws-resource-ec2-securitygroup.html
  it("la regla de egreso solo a 127.0.0.1/32 con IpProtocol -1 no es un ingreso abierto", () => {
    const template = {
      Resources: {
        VPC: { Type: "AWS::EC2::VPC", Properties: { CidrBlock: "10.0.0.0/16" } },
        sgwithoutegress: {
          Type: "AWS::EC2::SecurityGroup",
          Properties: {
            GroupDescription: "Limits security group egress traffic",
            SecurityGroupEgress: [{ CidrIp: "127.0.0.1/32", IpProtocol: "-1" }],
            VpcId: { Ref: "VPC" },
          },
        },
      },
    };
    expect(validateTemplate(template)).toEqual([]);
    expect(securityIssues(template, [{ type: "sg-open-ingress", port: 22 }])).toEqual([]);
  });

  // Fuente: https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/aws-properties-s3-bucket-publicaccessblockconfiguration.html
  it("las cuatro opciones de PublicAccessBlockConfiguration: el ejemplo con las cuatro en false se informa con requireAll", () => {
    const template = {
      AWSTemplateFormatVersion: "2010-09-09",
      Resources: {
        S3Bucket: {
          Type: "AWS::S3::Bucket",
          Properties: {
            PublicAccessBlockConfiguration: {
              BlockPublicAcls: false,
              BlockPublicPolicy: false,
              IgnorePublicAcls: false,
              RestrictPublicBuckets: false,
            },
            WebsiteConfiguration: { IndexDocument: "index.html", ErrorDocument: "error.html" },
          },
          DeletionPolicy: "Retain",
          UpdateReplacePolicy: "Retain",
        },
      },
    };
    expect(validateTemplate(template)).toEqual([]);
    expect(securityIssues(template, [{ type: "s3-no-public-access-block" }])).toEqual([]);
    const strict = securityIssues(template, [{ type: "s3-no-public-access-block", requireAll: true }]);
    expect(strict.map((issue) => issue.path)).toEqual([
      "Resources.S3Bucket.Properties.PublicAccessBlockConfiguration.BlockPublicAcls",
      "Resources.S3Bucket.Properties.PublicAccessBlockConfiguration.BlockPublicPolicy",
      "Resources.S3Bucket.Properties.PublicAccessBlockConfiguration.IgnorePublicAcls",
      "Resources.S3Bucket.Properties.PublicAccessBlockConfiguration.RestrictPublicBuckets",
    ]);
  });

  // Fuente: https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/aws-properties-s3-bucket-publicaccessblockconfiguration.html
  it("un bucket con las cuatro opciones en true cumple la regla estricta", () => {
    const template = {
      Resources: {
        Bucket: {
          Type: "AWS::S3::Bucket",
          Properties: {
            PublicAccessBlockConfiguration: {
              BlockPublicAcls: true,
              BlockPublicPolicy: true,
              IgnorePublicAcls: true,
              RestrictPublicBuckets: true,
            },
          },
        },
      },
    };
    expect(securityIssues(template, [{ type: "s3-no-public-access-block", requireAll: true }])).toEqual([]);
  });
});
